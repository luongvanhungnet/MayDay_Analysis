import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Observable, map } from "rxjs";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500;
    let code = 9000;
    let message = "Internal server error";
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      if (typeof body === "object" && body) {
        const value = body as { code?: number; message?: string | string[] };
        code =
          value.code ??
          (status === 401
            ? 3003
            : status === 403
              ? 3101
              : status === 404
                ? 4004
                : 2003);
        message = Array.isArray(value.message)
          ? value.message.join(", ")
          : (value.message ?? error.message);
        if (
          status === 413 ||
          /too many files|unexpected field|file too large/i.test(message)
        )
          code = 6003;
      } else message = String(body);
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2010") {
        const state = String(error.meta?.code ?? "");
        status = state.startsWith("23")
          ? 409
          : state.startsWith("22")
            ? 400
            : 500;
        code = status === 500 ? 9000 : 2003;
        const constraint = String(error.meta?.message ?? "").match(
          /constraint "([^"]+)"/,
        )?.[1];
        message =
          state === "23503"
            ? "Bản ghi liên kết không tồn tại hoặc đang được sử dụng"
            : state === "23505"
              ? "Dữ liệu đã tồn tại"
              : state === "23502"
                ? "Thiếu trường bắt buộc"
                : state === "23514"
                  ? `Dữ liệu không thỏa điều kiện${constraint ? ` (${constraint})` : ""}`
                  : status === 400
                    ? "Giá trị nhập không đúng định dạng"
                    : "Không thể lưu dữ liệu";
        host
          .switchToHttp()
          .getResponse()
          .status(status)
          .json({ code, message, data: null });
        return;
      }
      status = error.code === "P2025" ? 404 : 409;
      code =
        error.code === "P2002" ? 2003 : error.code === "P2025" ? 4004 : 2003;
      message =
        error.code === "P2002"
          ? "Data already exists"
          : error.code === "P2025"
            ? "Resource not found"
            : "Cannot change linked data";
    }
    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({ code, message, data: null });
  }
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((raw) => {
        const data = JSON.parse(
          JSON.stringify(raw ?? null, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        );
        const created = context.switchToHttp().getResponse().statusCode === 201;
        if (
          data &&
          typeof data === "object" &&
          "code" in data &&
          "data" in data
        )
          return data;
        if (
          data &&
          typeof data === "object" &&
          "meta" in data &&
          "data" in data
        ) {
          return {
            code: created ? 1001 : 1000,
            message: created ? "Created successfully" : "OK",
            ...data,
          };
        }
        return {
          code: created ? 1001 : 1000,
          message: created ? "Created successfully" : "OK",
          data: data ?? null,
        };
      }),
    );
  }
}

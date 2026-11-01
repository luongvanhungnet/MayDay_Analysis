import "reflect-metadata";
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../auth/access.decorator";
import { Actor } from "../native/schema";
import { NativeService } from "../native/native.service";
import { PrismaService } from "../common/prisma.service";
import { endpoints } from "./catalog";
import { SpecService } from "./service";
import { Media } from "./media";
import { Upload } from "./contract";
import { requestDocumentation } from "./openapi";

type AuthRequest = Request & { user: Actor; file?: Upload };
@ApiTags("API đặc tả (schema hiện tại)")
@Controller()
export class SpecController {
  constructor(@Inject(SpecService) readonly service: SpecService) {}
}

// Register one real Nest handler per operation. The same catalogue drives coverage
// tests, Swagger and the documented schema limitations, avoiding wildcard routes.
const decorators = {
  GET: Get,
  POST: Post,
  PUT: Put,
  PATCH: Patch,
  DELETE: Delete,
};
endpoints.forEach((endpoint, index) => {
  const name = `operation${index + 1}`;
  const handler = async function (this: SpecController, request: AuthRequest) {
    const result = await this.service.execute({
      endpoint,
      actor: request.user,
      params: request.params as Record<string, string>,
      query: request.query,
      body: request.body ?? {},
      authorization: request.headers.authorization,
      ip: request.ip,
      file: request.file,
    });
    if (!result.ok) throw result.error;
    return result.data;
  };
  Object.defineProperty(SpecController.prototype, name, {
    value: handler,
    writable: true,
    configurable: true,
  });
  const descriptor = Object.getOwnPropertyDescriptor(
    SpecController.prototype,
    name,
  )!;
  decorators[endpoint.method](endpoint.path)(
    SpecController.prototype,
    name,
    descriptor,
  );
  Req()(SpecController.prototype, name, 0);
  ApiOperation({
    summary: endpoint.source,
    description:
      endpoint.limitation ?? "Ánh xạ dữ liệu vào schema PostgreSQL hiện tại.",
    operationId: name,
  })(SpecController.prototype, name, descriptor);
  ApiResponse({
    status:
      endpoint.action === "unsupported"
        ? 501
        : ["login", "logout", "password"].includes(endpoint.action)
          ? 200
          : endpoint.method === "POST"
            ? 201
            : 200,
    description:
      endpoint.limitation ?? "Thành công; bigint trả dưới dạng chuỗi.",
  })(SpecController.prototype, name, descriptor);
  if (endpoint.public) Public()(SpecController.prototype, name, descriptor);
  else ApiBearerAuth()(SpecController.prototype, name, descriptor);
  if (["login", "logout", "password"].includes(endpoint.action))
    HttpCode(200)(SpecController.prototype, name, descriptor);
  for (const match of endpoint.path.matchAll(/:([a-z_]+)/g))
    ApiParam({ name: match[1], type: String })(
      SpecController.prototype,
      name,
      descriptor,
    );
  if (
    [
      "list",
      "patients",
      "history",
      "scores",
      "files",
      "locations",
      "photos",
      "myEpisodes",
    ].includes(endpoint.action)
  ) {
    for (const field of ["page", "limit", "search"])
      ApiQuery({
        name: field,
        required: false,
        type: field === "search" ? String : Number,
      })(SpecController.prototype, name, descriptor);
  }
  const bodyDocumentation = requestDocumentation(endpoint);
  if (bodyDocumentation)
    ApiBody(bodyDocumentation)(SpecController.prototype, name, descriptor);
  if (endpoint.action === "upload") {
    UseInterceptors(
      FileInterceptor("image", {
        limits: {
          fileSize: 8 * 1024 * 1024,
          files: 1,
          fields: 3,
          fieldSize: 100000,
        },
      }),
    )(SpecController.prototype, name, descriptor);
    ApiConsumes("multipart/form-data")(
      SpecController.prototype,
      name,
      descriptor,
    );
  }
});

@Controller("image-attachments")
export class MediaContentController {
  constructor(
    @Inject(NativeService) private readonly native: NativeService,
    @Inject(PrismaService) private readonly db: PrismaService,
  ) {}
  @Get(":id/content")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Đọc ảnh private sau khi kiểm tra quyền bệnh án" })
  async content(@Req() request: AuthRequest, @Res() response: Response) {
    const media = await new Media(this.native, this.db).content(
      request.user,
      request.params.id,
    );
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader(
      "Content-Disposition",
      "attachment; filename*=UTF-8''" + encodeURIComponent(media.name),
    );
    response.type(media.mime).send(media.buffer);
  }
}

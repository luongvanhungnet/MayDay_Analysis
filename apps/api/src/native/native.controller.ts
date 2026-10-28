import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Public, PUBLIC_KEY } from "../auth/access.decorator";
import { NativeService } from "./native.service";
import { Actor } from "./schema";

interface Request {
  user: Actor;
  ip: string;
  headers: { authorization?: string };
}
@Injectable()
export class NativeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly native: NativeService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride(PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<Request>();
    request.user = await this.native.authenticate(
      request.headers.authorization,
    );
    return true;
  }
}
@Controller()
export class NativeController {
  constructor(private readonly native: NativeService) {}
  @Post("auth/login") @Public() @HttpCode(200) login(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.native.login(body ?? {}, req.ip);
  }
  @Post("auth/logout") @HttpCode(200) logout(
    @Headers("authorization") header: string,
  ) {
    return this.native.logout(header);
  }
  @Get("auth/me") me(@Req() req: Request) {
    return this.native.profile(req.user);
  }
  @Get("auth/profile") profile(@Req() req: Request) {
    return this.native.profile(req.user);
  }
  @Post("auth/change-password") @HttpCode(200) password(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.native.changePassword(req.user, body ?? {});
  }
  @Get("data/schema") schema(@Req() req: Request) {
    return this.native.schema(req.user);
  }
  @Post("data/patients") patient(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.native.createPerson(req.user, body ?? {});
  }
  @Get("data/:table") list(
    @Req() req: Request,
    @Param("table") table: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.native.list(req.user, table, query);
  }
  @Get("data/:table/:key") detail(
    @Req() req: Request,
    @Param("table") table: string,
    @Param("key") key: string,
  ) {
    return this.native.detail(req.user, table, key);
  }
  @Post("data/:table") create(
    @Req() req: Request,
    @Param("table") table: string,
    @Body() body: unknown,
  ) {
    return this.native.create(req.user, table, body);
  }
  @Patch("data/:table/:key") update(
    @Req() req: Request,
    @Param("table") table: string,
    @Param("key") key: string,
    @Body() body: unknown,
  ) {
    return this.native.update(req.user, table, key, body);
  }
  @Delete("data/:table/:key") remove(
    @Req() req: Request,
    @Param("table") table: string,
    @Param("key") key: string,
  ) {
    return this.native.remove(req.user, table, key);
  }
}

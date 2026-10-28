import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "./auth/access.decorator";
import { PrismaService } from "./common/prisma.service";
@Controller("health")
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get() @Public() async health() {
    try {
      await this.db.$queryRaw`SELECT 1 FROM public.taikhoan LIMIT 1`;
      return { status: "ok", database: "connected" };
    } catch {
      throw new ServiceUnavailableException(
        "Không kết nối được database MayDay",
      );
    }
  }
}

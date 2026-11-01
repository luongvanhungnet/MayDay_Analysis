import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaService } from "./common/prisma.service";
import { NativeController, NativeGuard } from "./native/native.controller";
import { NativeService } from "./native/native.service";
import { HealthController } from "./health.controller";
import { AiController } from "./ai/ai.controller";
@Module({
  controllers: [NativeController, HealthController, AiController],
  providers: [
    PrismaService,
    NativeService,
    { provide: APP_GUARD, useClass: NativeGuard },
  ],
})
export class AppModule {}

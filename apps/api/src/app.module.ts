import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './common/database.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { AdminModule } from './admin/admin.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { ClinicalModule } from './clinical/clinical.module';
import { FormsModule } from './forms/forms.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthController } from './health.controller';

@Module({ imports: [DatabaseModule, EventEmitterModule.forRoot(), AuthModule, AdminModule, FacilitiesModule, ClinicalModule, FormsModule, MediaModule, NotificationsModule], controllers: [HealthController], providers: [{ provide: APP_GUARD, useExisting: JwtAuthGuard }, { provide: APP_GUARD, useExisting: PermissionsGuard }] })
export class AppModule {}

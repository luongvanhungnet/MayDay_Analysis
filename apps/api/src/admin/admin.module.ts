import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminUsersController, ApiEndpointsController, PermissionsController, RolePermissionsController, RolesController } from './admin.controller';

@Module({ imports: [AuthModule], controllers: [AdminUsersController, RolesController, PermissionsController, RolePermissionsController, ApiEndpointsController], providers: [AdminService] })
export class AdminModule {}

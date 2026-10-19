import { SetMetadata } from '@nestjs/common';
export const PUBLIC_KEY = 'mayday.public';
export const PERMISSION_KEY = 'mayday.permission';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

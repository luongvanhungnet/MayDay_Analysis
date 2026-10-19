import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface Actor {
  id: string;
  role: string;
  role_id?: string;
  token_id?: string;
  token_version?: number;
  expires_at?: number;
}
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => context.switchToHttp().getRequest().user);

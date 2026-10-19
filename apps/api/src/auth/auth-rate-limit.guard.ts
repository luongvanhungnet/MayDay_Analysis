import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RateLimitWindow } from './rate-limit';
import { DomainException } from '../common/domain.exception';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly limiter = new RateLimitWindow(10, 600000);
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!this.limiter.allow(`${request.ip}:${request.route?.path}`)) throw new DomainException(3012, 'Too many authentication attempts. Try again in 10 minutes.', 429);
    return true;
  }
}

import { HttpException } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(readonly code: number, message: string, status = 400) {
    super({ code, message }, status);
  }
}

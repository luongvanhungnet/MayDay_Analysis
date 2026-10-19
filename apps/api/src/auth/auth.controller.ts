import { Body, Controller, Get, Headers, HttpCode, Inject, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../common/validation';
import { AuthService } from './auth.service';
import { Public, RequirePermission } from './access.decorator';
import { Actor, CurrentUser } from './current-user.decorator';
import { changePasswordSchema, createStaffSchema, forgotSchema, loginSchema, profileSchema, resetSchema, signupSchema } from './auth.spec';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Public() @Post('signup')
  @UseGuards(AuthRateLimitGuard)
  signup(@Body() raw: unknown) { return this.auth.signup(parse(signupSchema, raw)); }
  @Public() @Post('login') @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  login(@Body() raw: unknown) { const input = parse(loginSchema, raw); return this.auth.login(input.phone ?? input.email!, input.password); }
  @Post('logout') @HttpCode(200)
  logout(@CurrentUser() actor: Actor, @Headers('authorization') header: string, @Body() raw: unknown) { const input = parse(z.object({ device_id: z.string().max(200).optional() }).strict(), raw ?? {}); return this.auth.logout(actor, header.slice(7), input.device_id); }
  @Public() @Post('forgot-password') @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  forgot(@Body() raw: unknown) { return this.auth.forgotPassword(parse(forgotSchema, raw).phone); }
  @Public() @Post('reset-password') @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  reset(@Body() raw: unknown) { const input = parse(resetSchema, raw); return this.auth.resetPassword(input.phone, input.token, input.newPassword); }
  @Put('change-password')
  change(@CurrentUser() actor: Actor, @Body() raw: unknown, @Headers('authorization') header: string) { const input = parse(changePasswordSchema, raw); return this.auth.changePassword(actor, input.oldPassword, input.newPassword, header.slice(7)); }
  @RequirePermission('admin.manage') @Post('admin/create-staff')
  createStaff(@Body() raw: unknown) { return this.auth.createStaff(parse(createStaffSchema, raw)); }
}

@Controller('profile')
export class ProfileController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Get() profile(@CurrentUser() actor: Actor) { return this.auth.profile(actor.id); }
  @Put() update(@CurrentUser() actor: Actor, @Body() raw: unknown) { return this.auth.updateProfile(actor.id, parse(profileSchema, raw)); }
}

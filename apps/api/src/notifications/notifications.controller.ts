import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { RequirePermission } from '../auth/access.decorator';
import { Actor, CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() @RequirePermission('notifications.read') list(@CurrentUser() actor: Actor) { return this.service.list(actor); }
  @Post() @RequirePermission('notifications.write') register(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.service.register(actor, body); }
  @Get('settings') @RequirePermission('notifications.read') settings(@CurrentUser() actor: Actor) { return this.service.settings(actor); }
  @Put('settings') @RequirePermission('notifications.write') updateSettings(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.service.updateSettings(actor, body); }
  @Put(':id/read') @RequirePermission('notifications.write') read(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.service.read(actor, id); }
  @Delete(':id') @RequirePermission('notifications.write') remove(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.service.remove(actor, id); }
}

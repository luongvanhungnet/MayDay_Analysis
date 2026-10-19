import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { RequirePermission } from '../auth/access.decorator';
import { Actor, CurrentUser } from '../auth/current-user.decorator';
import { FormsService } from './forms.service';

@Controller('templates')
export class FormsController {
  constructor(private readonly service: FormsService) {}
  @Get('all') @RequirePermission('templates.read') list(@CurrentUser() actor: Actor) { return this.service.list(actor); }
  @Get(':id') @RequirePermission('templates.read') detail(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.service.detail(actor, id); }
  @Post() @RequirePermission('templates.write') create(@Body() body: unknown) { return this.service.create(body); }
  @Put(':id') @RequirePermission('templates.write') update(@Param('id') id: string, @Body() body: unknown) { return this.service.update(id, body); }
  @Delete(':id') @RequirePermission('templates.write') remove(@Param('id') id: string) { return this.service.remove(id); }
  @Post(':template_id/sections') @RequirePermission('templates.write') createSection(@Param('template_id') id: string, @Body() body: unknown) { return this.service.createSection(id, body); }
  @Put('sections/:id') @RequirePermission('templates.write') updateSection(@Param('id') id: string, @Body() body: unknown) { return this.service.updateSection(id, body); }
  @Delete('sections/:id') @RequirePermission('templates.write') removeSection(@Param('id') id: string) { return this.service.removeSection(id); }
  @Post('sections/:section_id/questions') @RequirePermission('templates.write') createQuestion(@Param('section_id') id: string, @Body() body: unknown) { return this.service.createQuestion(id, body); }
  @Put('questions/:id') @RequirePermission('templates.write') updateQuestion(@Param('id') id: string, @Body() body: unknown) { return this.service.updateQuestion(id, body); }
  @Delete('questions/:id') @RequirePermission('templates.write') removeQuestion(@Param('id') id: string) { return this.service.removeQuestion(id); }
}

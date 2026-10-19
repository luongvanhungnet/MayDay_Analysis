import { Controller, Delete, Get, Param, Post, Res, Body, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { Actor, CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission } from '../auth/access.decorator';
import { MediaService } from './media.service';
@Controller('image-attachments')
export class MediaController {
  constructor(private readonly service: MediaService) {}
  @Post('upload') @RequirePermission('media.write')
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 0 } }))
  upload(@CurrentUser() actor: Actor, @UploadedFiles() files: Express.Multer.File[]) { return this.service.upload(actor, files); }
  @Get('user/:user_id') @RequirePermission('media.read') list(@CurrentUser() actor: Actor, @Param('user_id') id: string) { return this.service.list(actor, id); }
  @Get(':id/content') @RequirePermission('media.read') async content(@CurrentUser() actor: Actor, @Param('id') id: string, @Res() response: Response) {
    const { media, stream } = await this.service.content(actor, id);
    response.setHeader('Content-Type', media.mime_type); response.setHeader('Cache-Control', 'private, no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    stream.on('error', () => response.destroy()); stream.pipe(response);
  }
  @Delete(':id') @RequirePermission('media.write') remove(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.service.remove(actor, id); }
}
@Controller('answer-images')
export class AnswerImagesController {
  constructor(private readonly service: MediaService) {}
  @Post() @RequirePermission('media.write') attach(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.service.attach(actor, body); }
  @Get(':answer_id') @RequirePermission('media.read') list(@CurrentUser() actor: Actor, @Param('answer_id') id: string) { return this.service.answerImages(actor, id); }
  @Delete(':id') @RequirePermission('media.write') detach(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.service.detach(actor, id); }
}

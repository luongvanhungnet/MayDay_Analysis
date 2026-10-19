import { Module } from '@nestjs/common';
import { ClinicalModule } from '../clinical/clinical.module';
import { MediaController, AnswerImagesController } from './media.controller';
import { MediaService } from './media.service';
import { AiController } from './ai.controller';
@Module({ imports: [ClinicalModule], controllers: [MediaController, AnswerImagesController, AiController], providers: [MediaService], exports: [MediaService] })
export class MediaModule {}

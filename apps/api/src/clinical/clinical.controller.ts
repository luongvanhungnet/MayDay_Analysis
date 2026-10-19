import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { RequirePermission } from '../auth/access.decorator';
import { Actor, CurrentUser } from '../auth/current-user.decorator';
import { ClinicalService } from './clinical.service';
import { LesionsService } from './lesions.service';

@Controller('medical_records')
@RequirePermission('view_records')
export class MedicalRecordsController {
  constructor(@Inject(ClinicalService) private readonly clinical: ClinicalService) {}
  @Get('classify-questions') classifyQuestions() { return this.clinical.classifyQuestions(); }
  @Post('classify') @HttpCode(200) classify(@Body() body: unknown) { return this.clinical.classify(body); }
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.clinical.createRecord(actor, body); }
  @Get('all') all(@CurrentUser() actor: Actor, @Query() query: Record<string, unknown>) { return this.clinical.allRecords(actor, query); }
  @Get('patients/:id/history') history(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.clinical.history(actor, id); }
  @Get(':id/summary') summary(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.clinical.summary(actor, id); }
  @Get(':id/answers') answers(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.clinical.answers(actor, id); }
  @Put(':id/answers') @RequirePermission('manage_records') updateAnswers(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() body: unknown) { return this.clinical.updateAnswers(actor, id, body); }
  @Post(':id/answers') @HttpCode(200) @RequirePermission('manage_records') setAnswers(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() body: unknown) { return this.clinical.updateAnswers(actor, id, body); }
  @Post(':id/accept') @HttpCode(200) @RequirePermission('manage_records') accept(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.clinical.accept(actor, id); }
  @Get(':id') detail(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.clinical.record(actor, id); }
  @Put(':id') @RequirePermission('manage_records') complete(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() body: unknown) { return this.clinical.complete(actor, id, body); }
  @Delete(':id') @RequirePermission('manage_records') delete(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.clinical.deleteRecord(actor, id); }
}

@Controller('doctor/patients')
@RequirePermission('view_records')
export class DoctorPatientsController {
  constructor(@Inject(ClinicalService) private readonly clinical: ClinicalService) {}
  @Get('search') search(@CurrentUser() actor: Actor, @Query() query: Record<string, unknown>) { return this.clinical.searchPatients(actor, query); }
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.clinical.createPatient(actor, body); }
}

@Controller('uas7-scores')
@RequirePermission('view_records')
export class Uas7Controller {
  constructor(@Inject(ClinicalService) private readonly clinical: ClinicalService) {}
  @Get('eligibility') eligibility(@CurrentUser() actor: Actor) { return this.clinical.uasEligibility(actor); }
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.clinical.createUas(actor, body); }
  @Get('patient/:id') history(@CurrentUser() actor: Actor, @Param('id') id: string, @Query('end_date') endDate?: string) { return this.clinical.uasHistory(actor, id, endDate); }
}

@Controller('prescriptions')
@RequirePermission('view_records')
export class PrescriptionsController {
  constructor(@Inject(ClinicalService) private readonly clinical: ClinicalService) {}
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.clinical.createPrescription(actor, body); }
  @Get('record/:id') list(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.clinical.prescriptions(actor, id); }
}

@Controller('lab-requests')
@RequirePermission('view_records')
export class LabRequestsController {
  constructor(@Inject(ClinicalService) private readonly clinical: ClinicalService) {}
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.clinical.createLabRequest(actor, body); }
  @Get('record/:id') list(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.clinical.labRequests(actor, id); }
}

@Controller('lab-results')
@RequirePermission('view_records')
export class LabResultsController {
  constructor(@Inject(ClinicalService) private readonly clinical: ClinicalService) {}
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.clinical.createLabResult(actor, body); }
  @Get(':record_id') list(@CurrentUser() actor: Actor, @Param('record_id') recordId: string) { return this.clinical.labResults(actor, recordId); }
}

@Controller('lesion-episodes')
@RequirePermission('view_records')
export class LesionEpisodesController {
  constructor(@Inject(LesionsService) private readonly lesions: LesionsService) {}
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.lesions.createEpisode(actor, body); }
  @Get('my') my(@CurrentUser() actor: Actor) { return this.lesions.myEpisodes(actor); }
  @Get('patient/:id') patient(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.lesions.patientEpisodes(actor, id); }
  @Get('record/:id') record(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.lesions.recordEpisodes(actor, id); }
  @Get(':id') detail(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.lesions.episode(actor, id); }
  @Patch(':id') @RequirePermission('manage_records') update(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() body: unknown) { return this.lesions.updateEpisode(actor, id, body); }
  @Delete(':id') @RequirePermission('manage_records') delete(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.lesions.deleteEpisode(actor, id); }
}

@Controller('lesion-locations')
@RequirePermission('view_records')
export class LesionLocationsController {
  constructor(@Inject(LesionsService) private readonly lesions: LesionsService) {}
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.lesions.createLocation(actor, body); }
  @Get('episode/:id') list(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.lesions.locations(actor, id); }
  @Patch(':id') @RequirePermission('manage_records') update(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() body: unknown) { return this.lesions.updateLocation(actor, id, body); }
  @Delete(':id') @RequirePermission('manage_records') delete(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.lesions.deleteLocation(actor, id); }
}

@Controller('lesion-photos')
@RequirePermission('view_records')
export class LesionPhotosController {
  constructor(@Inject(LesionsService) private readonly lesions: LesionsService) {}
  @Post() @RequirePermission('manage_records') create(@CurrentUser() actor: Actor, @Body() body: unknown) { return this.lesions.createPhoto(actor, body); }
  @Get('location/:id') list(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.lesions.photos(actor, id); }
  @Patch(':id/milestone') @RequirePermission('manage_records') update(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() body: unknown) { return this.lesions.updatePhotoMilestone(actor, id, body); }
  @Delete(':id') @RequirePermission('manage_records') delete(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.lesions.deletePhoto(actor, id); }
}

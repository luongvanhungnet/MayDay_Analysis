import { Module } from '@nestjs/common';
import { ClinicalService } from './clinical.service';
import { RecordAccessService } from './record-access.service';
import { LesionsService } from './lesions.service';
import { DoctorPatientsController, LabRequestsController, LabResultsController, LesionEpisodesController, LesionLocationsController, LesionPhotosController, MedicalRecordsController, PrescriptionsController, Uas7Controller } from './clinical.controller';

@Module({
  controllers: [MedicalRecordsController, DoctorPatientsController, Uas7Controller, PrescriptionsController, LabRequestsController, LabResultsController, LesionEpisodesController, LesionLocationsController, LesionPhotosController],
  providers: [ClinicalService, RecordAccessService, LesionsService],
  exports: [ClinicalService, RecordAccessService, LesionsService],
})
export class ClinicalModule {}

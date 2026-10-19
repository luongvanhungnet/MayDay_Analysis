import { Module } from '@nestjs/common';
import { FacilitiesService } from './facilities.service';
import { BranchesController, DepartmentsController, RoomsController } from './facilities.controller';
@Module({ controllers: [BranchesController, DepartmentsController, RoomsController], providers: [FacilitiesService] })
export class FacilitiesModule {}

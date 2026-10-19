import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermission } from '../auth/access.decorator';
import { parse, paginationSchema, uuid } from '../common/validation';
import { branchSchema, departmentSchema, roomSchema } from './facilities.spec';
import { FacilitiesService } from './facilities.service';

@RequirePermission('admin.manage') @Controller('branches')
export class BranchesController {
  constructor(@Inject(FacilitiesService) private readonly facilities: FacilitiesService) {}
  @Get() list(@Query() raw: unknown) { const input = parse(paginationSchema, raw); return this.facilities.branches(input.page, input.limit, input.search); }
  @Get(':id') detail(@Param('id') id: string) { return this.facilities.branch(parse(uuid, id)); }
  @Post() create(@Body() raw: unknown) { return this.facilities.createBranch(parse(branchSchema, raw)); }
  @Put(':id') update(@Param('id') id: string, @Body() raw: unknown) { return this.facilities.updateBranch(parse(uuid, id), parse(branchSchema.partial(), raw)); }
  @Delete(':id') remove(@Param('id') id: string) { return this.facilities.deleteBranch(parse(uuid, id)); }
}

@RequirePermission('admin.manage') @Controller('departments')
export class DepartmentsController {
  constructor(@Inject(FacilitiesService) private readonly facilities: FacilitiesService) {}
  @Get() list(@Query() raw: unknown) { const input = parse(paginationSchema.extend({ branch_id: uuid.optional() }), raw); return this.facilities.departments(input.page, input.limit, input.branch_id); }
  @Get(':id') detail(@Param('id') id: string) { return this.facilities.department(parse(uuid, id)); }
  @Post() create(@Body() raw: unknown) { return this.facilities.createDepartment(parse(departmentSchema, raw)); }
  @Put(':id') update(@Param('id') id: string, @Body() raw: unknown) { return this.facilities.updateDepartment(parse(uuid, id), parse(departmentSchema.partial(), raw)); }
  @Delete(':id') remove(@Param('id') id: string) { return this.facilities.deleteDepartment(parse(uuid, id)); }
}

@RequirePermission('admin.manage') @Controller('rooms')
export class RoomsController {
  constructor(@Inject(FacilitiesService) private readonly facilities: FacilitiesService) {}
  @Get() list(@Query() raw: unknown) { const input = parse(paginationSchema.extend({ department_id: uuid.optional() }), raw); return this.facilities.rooms(input.page, input.limit, input.department_id); }
  @Get(':id') detail(@Param('id') id: string) { return this.facilities.room(parse(uuid, id)); }
  @Post() create(@Body() raw: unknown) { return this.facilities.createRoom(parse(roomSchema, raw)); }
  @Put(':id') update(@Param('id') id: string, @Body() raw: unknown) { return this.facilities.updateRoom(parse(uuid, id), parse(roomSchema.partial(), raw)); }
  @Delete(':id') remove(@Param('id') id: string) { return this.facilities.deleteRoom(parse(uuid, id)); }
}

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../auth/current-user.decorator';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../common/prisma.service';
import { parse } from '../common/validation';
import { id } from './clinical.dto';
import { RecordPolicyHandler } from './contracts';

export interface RecordAccessOptions { write?: boolean; client?: Prisma.TransactionClient }

@Injectable()
export class RecordAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertRecord(actor: Actor, recordId: string, options: RecordAccessOptions = {}) {
    const client = options.client ?? this.prisma;
    const record = await client.medicalRecord.findUnique({ where: { id: parse(id, recordId) } });
    if (!record) throw new DomainException(4001, 'Medical record not found', 404);
    if (!['pending', 'in_progress', 'completed'].includes(record.status)) throw new DomainException(4004, 'Invalid medical record status', 409);
    const result = new RecordPolicyHandler().execute({ actor, record: { ...record, status: record.status as 'pending' | 'in_progress' | 'completed' }, action: 'read' });
    if (!result.success) throw new DomainException(result.error.code, result.error.message, 403);
    if (options.write && record.status === 'completed') throw new DomainException(4003, 'Medical record already completed', 409);
    return record;
  }

  async assertPatient(actor: Actor, patientId: string) {
    parse(id, patientId);
    if (actor.role === 'patient' && actor.id !== patientId) throw new DomainException(3106, "Cannot access another user's data", 403);
    if (actor.role !== 'patient' && actor.role !== 'admin') {
      const assigned = await this.prisma.medicalRecord.findFirst({ where: { patient_id: patientId, assigned_doctor_id: actor.id }, select: { id: true } });
      if (!assigned) throw new DomainException(3105, 'Doctor not assigned to this patient', 403);
    }
    const patient = await this.prisma.patient.findUnique({ where: { user_id: patientId } });
    if (!patient) throw new DomainException(3007, 'Patient not found', 404);
    return patient;
  }

  /** Row lock serializes child writes and closing a record so a completed record remains immutable. */
  async withRecordWrite<T>(actor: Actor, recordId: string, operation: (client: Prisma.TransactionClient, record: Awaited<ReturnType<RecordAccessService['assertRecord']>>) => Promise<T>): Promise<T> {
    parse(id, recordId);
    return this.prisma.$transaction(async client => {
      await client.$queryRaw(Prisma.sql`SELECT id FROM medical_records WHERE id = ${recordId}::uuid FOR UPDATE`);
      const record = await this.assertRecord(actor, recordId, { write: true, client });
      return operation(client, record);
    });
  }

  requireStaff(actor: Actor) {
    if (actor.role === 'patient') throw new DomainException(3101, 'Clinical staff role required', 403);
  }
}

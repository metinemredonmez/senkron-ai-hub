import { ConflictException, Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { TenantContextService } from '@/common/context/tenant-context.service';
import { RedisService } from '@/lib/nestjs-redis';
import { IdempotencyService } from '@/common/services/idempotency.service';
import { REDACTION_MASK } from '@/common/constants/app.constants';
import { Doctor365Client } from './doctor365.client';
import { ProviderQueryDto } from './dto/provider-query.dto';
import { ProviderSummaryDto } from './dto/provider-response.dto';
import { SyncPatientDto } from './dto/sync-patient.dto';
import { PatientSyncResponseDto } from './dto/patient-response.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentProxyResponseDto } from './dto/appointment-response.dto';
import { PatientDealDto } from './dto/patient-deal.dto';
import { PatientFlightDataDto } from './dto/patient-flight-data.dto';
import { AppointmentDealDto } from './dto/appointment-deal.dto';
import {
  Doctor365Appointment,
  Doctor365Patient,
  Doctor365Provider,
} from './types';

const WRITE_CACHE_TTL_SECONDS = 60 * 30;

@Injectable()
export class Doctor365Service {
  private readonly redis: Redis;

  constructor(
    private readonly client: Doctor365Client,
    private readonly tenantContext: TenantContextService,
    private readonly redisService: RedisService,
    private readonly idempotencyService: IdempotencyService,
    private readonly logger: PinoLogger,
  ) {
    this.redis = this.redisService.getClient();
    this.logger.setContext(Doctor365Service.name);
  }

  async listProviders(
    query: ProviderQueryDto,
  ): Promise<{ providers: ProviderSummaryDto[] }> {
    const filters = this.stripUndefined(query as unknown as Record<string, any>);
    const providers = await this.client.fetchProviders(filters);
    return {
      providers: providers.map((provider) => this.toProviderSummary(provider)),
    };
  }

  async fetchPatient(
    doktor365Id: string,
  ): Promise<PatientSyncResponseDto> {
    const patient = await this.client.fetchPatient(doktor365Id);
    return this.toPatientResponse(patient, undefined);
  }

  async synchronizePatient(
    dto: SyncPatientDto,
    idempotencyKey?: string,
  ): Promise<PatientSyncResponseDto> {
    const tenantId = this.tenantContext.getTenantId();

    if (!dto.consentGranted) {
      throw new ConflictException(
        'Cannot synchronize patient without explicit KVKK/GDPR consent',
      );
    }

    const scopedKey = this.buildScopedKey(
      tenantId,
      'patient',
      idempotencyKey ?? dto.patientId,
    );
    const cached = await this.getCachedResult<PatientSyncResponseDto>(
      scopedKey.cacheKey,
    );
    if (cached) {
      return cached;
    }

    const acquired = await this.idempotencyService.acquire(
      scopedKey.lockKey,
      60,
    );
    if (!acquired) {
      await this.sleep(250);
      const hydrated = await this.getCachedResult<PatientSyncResponseDto>(
        scopedKey.cacheKey,
      );
      if (hydrated) {
        return hydrated;
      }
      throw new ConflictException(
        'Patient synchronization already in progress',
      );
    }

    try {
      const payload = this.mapPatientPayload(dto);
      const patient = await this.client.upsertPatient(payload);
      const response = this.toPatientResponse(patient, dto.patientId);
      await this.cacheResult(scopedKey.cacheKey, response);
      return response;
    } catch (error) {
      this.logger.error(
        { error: (error as Error)?.message ?? REDACTION_MASK },
        'Failed to synchronize patient with Doktor365',
      );
      throw error;
    } finally {
      await this.idempotencyService.release(scopedKey.lockKey);
    }
  }

  async createAppointment(
    dto: CreateAppointmentDto,
    idempotencyKey?: string,
  ): Promise<AppointmentProxyResponseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const scopedKey = this.buildScopedKey(
      tenantId,
      'appointment',
      idempotencyKey ?? dto.appointmentId,
    );
    const cached = await this.getCachedResult<AppointmentProxyResponseDto>(
      scopedKey.cacheKey,
    );
    if (cached) {
      return cached;
    }

    const acquired = await this.idempotencyService.acquire(
      scopedKey.lockKey,
      60,
    );
    if (!acquired) {
      await this.sleep(250);
      const hydrated = await this.getCachedResult<AppointmentProxyResponseDto>(
        scopedKey.cacheKey,
      );
      if (hydrated) {
        return hydrated;
      }
      throw new ConflictException(
        'Appointment creation already in progress',
      );
    }

    try {
      const payload = this.mapAppointmentPayload(dto);
      const appointment = await this.client.createAppointment(payload);
      const response = this.toAppointmentResponse(appointment, dto.appointmentId);
      await this.cacheResult(scopedKey.cacheKey, response);
      return response;
    } catch (error) {
      this.logger.error(
        { error: (error as Error)?.message ?? REDACTION_MASK },
        'Failed to create Doktor365 appointment',
      );
      throw error;
    } finally {
      await this.idempotencyService.release(scopedKey.lockKey);
    }
  }

  async createPatientDeal(dto: PatientDealDto): Promise<Record<string, unknown>> {
    const payload = this.stripUndefined({
      patient_id: dto.doktor365PatientId,
      deal_id: dto.dealId,
      note_type: dto.noteType,
      notes: dto.notes,
    });
    return this.client.createPatientDeal(payload);
  }

  async sendFlightData(dto: PatientFlightDataDto): Promise<Record<string, unknown>> {
    const payload = this.stripUndefined({
      patient_id: dto.doktor365PatientId,
      itinerary_id: dto.itineraryId,
      flight_number: dto.flightNumber,
      departure_at: dto.departureAt,
      arrival_at: dto.arrivalAt,
      metadata: dto.metadata,
    });
    return this.client.sendFlightData(payload);
  }

  async createAppointmentDeal(dto: AppointmentDealDto): Promise<Record<string, unknown>> {
    const payload = this.stripUndefined({
      appointment_id: dto.doktor365AppointmentId,
      deal_id: dto.dealId,
      note_type: dto.noteType,
      notes: dto.notes,
    });
    return this.client.createAppointmentDeal(payload);
  }

  private toProviderSummary(
    provider: Doctor365Provider,
  ): ProviderSummaryDto {
    return {
      id: provider.id,
      name: provider.name,
      specialty: provider.specialty,
      location: provider.location,
      languageSupport: provider.languageSupport,
      accreditation: provider.accreditation,
      rating: provider.rating,
    };
  }

  private toPatientResponse(
    patient: Doctor365Patient,
    patientId?: string,
  ): PatientSyncResponseDto {
    return {
      doktor365Id: patient.id ?? patient.externalId,
      patientId: patientId ?? patient.externalId,
      status: patient.status,
      updatedAt: patient.updatedAt,
      lastSyncedAt: patient.lastSyncedAt,
      allergies: patient.allergies,
      bloodType: patient.bloodType,
      labResults: patient.labResults,
    };
  }

  private toAppointmentResponse(
    appointment: Doctor365Appointment,
    appointmentId: string,
  ): AppointmentProxyResponseDto {
    return {
      doktor365AppointmentId: appointment.id,
      appointmentId,
      status: appointment.status,
      scheduledAt: appointment.scheduledAt,
      location: appointment.location,
    };
  }

  private buildScopedKey(
    tenantId: string,
    resource: string,
    rawKey: string,
  ): { cacheKey: string; lockKey: string } {
    const digest = crypto
      .createHash('sha256')
      .update(`${tenantId}:${resource}:${rawKey}`)
      .digest('hex');
    return {
      cacheKey: `${tenantId}:doktor365:${resource}:result:${digest}`,
      lockKey: `${tenantId}:doktor365:${resource}:lock:${digest}`,
    };
  }

  private async getCachedResult<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    if (!cached) {
      return null;
    }
    try {
      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn(
        { key },
        'Failed to parse cached Doktor365 response; purging entry',
      );
      await this.redis.del(key);
      return null;
    }
  }

  private async cacheResult(key: string, value: unknown): Promise<void> {
    await this.redis.set(
      key,
      JSON.stringify(value),
      'EX',
      WRITE_CACHE_TTL_SECONDS,
    );
  }

  private mapPatientPayload(dto: SyncPatientDto): Record<string, unknown> {
    const payload = {
      patient_id: dto.patientId,
      doktor365_id: dto.doktor365Id,
      given_name: dto.givenName,
      family_name: dto.familyName,
      birth_date: dto.birthDate,
      gender: dto.gender,
      contact: this.stripUndefined({
        email: dto.contactEmail,
        phone: dto.contactPhone,
      }),
      identity_hash: dto.identityHash,
      consent: {
        granted: dto.consentGranted,
        recorded_at: dto.consentRecordedAt,
      },
      clinical_summary: dto.clinicalSummary,
      allergies: dto.allergies,
      blood_type: dto.bloodType,
      lab_results: dto.labResults,
    };
    return this.stripUndefined(payload);
  }

  private mapAppointmentPayload(
    dto: CreateAppointmentDto,
  ): Record<string, unknown> {
    return this.stripUndefined({
      appointment_id: dto.appointmentId,
      patient_id: dto.doktor365PatientId,
      provider_id: dto.doktor365ProviderId,
      scheduled_at: dto.scheduledAt,
      channel: dto.channel,
      notes: dto.notes,
    });
  }

  private stripUndefined<T extends Record<string, any>>(input: T): T {
    return Object.entries(input).reduce((acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }
      if (typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.stripUndefined(value as Record<string, any>);
        if (Object.keys(nested).length > 0) {
          (acc as Record<string, any>)[key] = nested;
        }
        return acc;
      }
      (acc as Record<string, any>)[key] = value;
      return acc;
    }, {} as T);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import { Test } from '@nestjs/testing';
import { Doctor365Service } from '../../src/modules/external/doctor365/doctor365.service';
import { Doctor365Client } from '../../src/modules/external/doctor365/doctor365.client';
import { TenantContextService } from '../../src/common/context/tenant-context.service';
import { RedisService } from '@/lib/nestjs-redis';
import { IdempotencyService } from '../../src/common/services/idempotency.service';
import { PinoLogger } from 'nestjs-pino';

const createRedisMock = () => {
  const store = new Map();
  return {
    get: jest.fn(async (key) => {
      const entry = store.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: jest.fn(
      async (key, value, mode, ttlSeconds) => {
        let expiresAt;
        if (mode === 'EX' && typeof ttlSeconds === 'number') {
          expiresAt = Date.now() + ttlSeconds * 1000;
        }
        store.set(key, { value, expiresAt });
        return 'OK';
      },
    ),
    del: jest.fn(async (key) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
  };
};

describe('Doctor365Service', () => {
  let service;
  let client;
  let idempotency;
  let redis;

  beforeEach(async () => {
    redis = createRedisMock();

    client = {
      fetchProviders: jest.fn(),
      fetchPatient: jest.fn(),
      upsertPatient: jest.fn(),
      createAppointment: jest.fn(),
    };

    idempotency = {
      acquire: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn(),
      remember: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        Doctor365Service,
        {
          provide: Doctor365Client,
          useValue: client,
        },
        {
          provide: TenantContextService,
          useValue: {
            getTenantId: jest.fn().mockReturnValue('tenant-123'),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: () => redis,
          },
        },
        {
          provide: IdempotencyService,
          useValue: idempotency,
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(Doctor365Service);
  });

  it('synchronizes patient and caches idempotent result', async () => {
    const nowIso = new Date().toISOString();
    client.upsertPatient.mockResolvedValue({
      id: 'd365-patient',
      externalId: 'd365-patient',
      status: 'active',
      updatedAt: nowIso,
      lastSyncedAt: nowIso,
    });

    const dto = {
      patientId: 'patient-123',
      givenName: 'Ada',
      familyName: 'Lovelace',
      consentGranted: true,
    };

    const response = await service.synchronizePatient(dto, 'idem-key');
    expect(response.doktor365Id).toBe('d365-patient');
    expect(client.upsertPatient).toHaveBeenCalledTimes(1);

    const cached = await service.synchronizePatient(dto, 'idem-key');
    expect(cached.doktor365Id).toBe('d365-patient');
    expect(client.upsertPatient).toHaveBeenCalledTimes(1);
    expect(idempotency.acquire).toHaveBeenCalledTimes(1);
    expect(idempotency.release).toHaveBeenCalledTimes(1);
  });

  it('creates appointment once and reuses cached response', async () => {
    const nowIso = new Date().toISOString();
    client.createAppointment.mockResolvedValue({
      id: 'd365-appt',
      patientId: 'd365-patient',
      providerId: 'd365-provider',
      scheduledAt: nowIso,
      status: 'confirmed',
      location: 'Istanbul',
    });

    const dto = {
      appointmentId: 'appt-123',
      doktor365PatientId: 'd365-patient',
      doktor365ProviderId: 'd365-provider',
      scheduledAt: nowIso,
    };

    const response = await service.createAppointment(dto, 'appt-key');
    expect(response.doktor365AppointmentId).toBe('d365-appt');
    expect(client.createAppointment).toHaveBeenCalledTimes(1);

    const cached = await service.createAppointment(dto, 'appt-key');
    expect(cached.doktor365AppointmentId).toBe('d365-appt');
    expect(client.createAppointment).toHaveBeenCalledTimes(1);
  });
});

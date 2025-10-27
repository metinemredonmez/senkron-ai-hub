import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CasesService } from '../../src/modules/cases/cases.service';
import { CaseEntity } from '../../src/database/entities/case.entity';
import { PatientEntity } from '../../src/database/entities/patient.entity';
import { PricingQuoteEntity } from '../../src/database/entities/pricing-quote.entity';
import { TravelPlanEntity } from '../../src/database/entities/travel-plan.entity';
import { ApprovalTaskEntity } from '../../src/database/entities/approval-task.entity';
import { TenantContextService } from '../../src/common/context/tenant-context.service';
import { AiBridgeService } from '../../src/modules/ai-bridge/ai-bridge.service';
import { EventBusService } from '../../src/common/services/event-bus.service';

const tenantId = 'tenant-1';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
});

const orchestratorResponse = {
  caseId: 'case-1',
  status: 'quote-ready',
  stage: 'pricing',
  currentNode: 'pricing',
  clinicalSummary: 'Summary',
  disclaimers: ['Non-diagnostic'],
  eligibility: { status: 'eligible', notes: [], redFlags: [] },
  pricing: {
    currency: 'EUR',
    total: 1200,
    travel: 200,
    breakdown: { treatment: 1000, travel: 200 },
    disclaimer: 'Pricing subject to change',
  },
  travelPlan: {
    flights: { option: 'mock' },
    accommodations: {},
    transfers: {},
    itinerary: { events: [] },
  },
  approvals: [],
  raw: {},
};

describe('CasesService', () => {
  let service: CasesService;
  let casesRepository: jest.Mocked<Repository<CaseEntity>>;
  let patientsRepository: jest.Mocked<Repository<PatientEntity>>;
  let pricingRepository: jest.Mocked<Repository<PricingQuoteEntity>>;
  let travelRepository: jest.Mocked<Repository<TravelPlanEntity>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CasesService,
        {
          provide: getRepositoryToken(CaseEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(PatientEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(PricingQuoteEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(TravelPlanEntity),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(ApprovalTaskEntity),
          useFactory: mockRepo,
        },
        {
          provide: TenantContextService,
          useValue: {
            getTenantId: jest.fn().mockReturnValue(tenantId),
          },
        },
        {
          provide: AiBridgeService,
          useValue: {
            startCaseOrchestration: jest
              .fn()
              .mockResolvedValue(orchestratorResponse),
            resumeCaseWithApproval: jest.fn(),
            fetchCheckpoint: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: EventBusService,
          useValue: { publish: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CasesService);
    casesRepository = module.get(getRepositoryToken(CaseEntity));
    patientsRepository = module.get(getRepositoryToken(PatientEntity));
    pricingRepository = module.get(getRepositoryToken(PricingQuoteEntity));
    travelRepository = module.get(getRepositoryToken(TravelPlanEntity));
  });

  it('creates case and triggers orchestration', async () => {
    const patient = { id: 'patient-1', tenantId } as PatientEntity;
    patientsRepository.findOne.mockResolvedValue(patient);
    casesRepository.create.mockImplementation((input) => input as any);
    casesRepository.save.mockImplementation(async (input) => input as any);
    pricingRepository.create.mockImplementation((input) => input as any);
    pricingRepository.save.mockImplementation(async (input) => input as any);
    travelRepository.create.mockImplementation((input) => input as any);
    travelRepository.save.mockImplementation(async (input) => input as any);

    const result = await service.create(
      {
        patientId: 'patient-1',
        title: 'New Case',
        targetProcedure: 'Knee Surgery',
      } as any,
      'user-1',
    );

    expect(result.status).toBe('quote-ready');
    expect(pricingRepository.create).toHaveBeenCalled();
    expect(casesRepository.save).toHaveBeenCalled();
  });
});

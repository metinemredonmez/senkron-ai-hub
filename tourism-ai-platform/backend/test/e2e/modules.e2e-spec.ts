import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FlightsController } from '../../src/modules/flights/flights.controller';
import { FlightsService } from '../../src/modules/flights/flights.service';
import { HotelsController } from '../../src/modules/hotels/hotels.controller';
import { HotelsService } from '../../src/modules/hotels/hotels.service';
import { SearchController } from '../../src/modules/search/search.controller';
import { SearchService } from '../../src/modules/search/search.service';
import { QueueController } from '../../src/modules/queue/queue.controller';
import { QueueService } from '../../src/modules/queue/queue.service';

describe('Feature modules (e2e)', () => {
  let app: INestApplication;
  let server: any;

  const flightsService = {
    search: jest.fn(async () => ({ data: [{ id: 'offer-1' }], meta: { currency: 'USD' } })),
    getById: jest.fn(async (id: string) => ({ data: { id } })),
  };

  const hotelsService = {
    search: jest.fn(async () => ({ data: [{ id: 'hotel-1' }], meta: { currency: 'USD' } })),
  };

  const searchService = {
    search: jest.fn(async (term: string) => ({
      query: term,
      tenantId: 'tenant-test',
      hits: [{ id: 'case-1', type: 'case' }],
      count: 1,
    })),
  };

  const queueService = {
    describeQueue: jest.fn(() => ({ topic: 'case.jobs', kafkaEnabled: true })),
    enqueue: jest.fn(async () => ({ acknowledged: true, tenantId: 'tenant-test' })),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [FlightsController, HotelsController, SearchController, QueueController],
      providers: [
        { provide: FlightsService, useValue: flightsService },
        { provide: HotelsService, useValue: hotelsService },
        { provide: SearchService, useValue: searchService },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns flight search results', async () => {
    await request(server)
      .get('/flights/search')
      .query({
        origin: 'IST',
        destination: 'JFK',
        departureDate: '2025-11-01',
        adults: 2,
        currency: 'USD',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ data: [{ id: 'offer-1' }] });
      });

    expect(flightsService.search).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'IST', destination: 'JFK' }),
    );
  });

  it('returns a single flight offer', async () => {
    await request(server).get('/flights/some-offer').expect(200).expect(({ body }) => {
      expect(body).toEqual({ data: { id: 'some-offer' } });
    });

    expect(flightsService.getById).toHaveBeenCalledWith('some-offer');
  });

  it('returns hotel search results', async () => {
    await request(server)
      .get('/hotels/search')
      .query({
        location: 'istanbul',
        checkInDate: '2025-11-05',
        checkOutDate: '2025-11-10',
        guests: 2,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ data: [{ id: 'hotel-1' }] });
      });

    expect(hotelsService.search).toHaveBeenCalled();
  });

  it('queries Redis-backed search index', async () => {
    await request(server)
      .get('/search')
      .query({ q: 'dental' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ query: 'dental', count: 1 });
      });

    expect(searchService.search).toHaveBeenCalledWith('dental');
  });

  it('describes queue metadata', async () => {
    await request(server)
      .get('/queue/jobs')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ topic: 'case.jobs', kafkaEnabled: true });
      });

    expect(queueService.describeQueue).toHaveBeenCalled();
  });

  it('enqueues job on Kafka topic', async () => {
    await request(server)
      .post('/queue/enqueue')
      .send({ jobType: 'case.followup.requested', payload: { caseId: 'case-1' } })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({ acknowledged: true, tenantId: 'tenant-test' });
      });

    expect(queueService.enqueue).toHaveBeenCalledWith('case.followup.requested', { caseId: 'case-1' });
  });
});

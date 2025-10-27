import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFlightDto } from '../../src/modules/flights/dto/create-flight.dto';
import { FlightSearchQueryDto } from '../../src/modules/flights/dto/flight-search.dto';
import { HotelSearchQueryDto } from '../../src/modules/hotels/dto/hotel-search.dto';
import { SearchQueryDto } from '../../src/modules/search/dto/search-query.dto';
import { EnqueueJobDto } from '../../src/modules/queue/dto/enqueue-job.dto';

async function expectInvalid(dto: object) {
  const errors = await validate(dto as Record<string, unknown>);
  expect(errors).not.toHaveLength(0);
}

async function expectValid(dto: object) {
  const errors = await validate(dto as Record<string, unknown>);
  expect(errors).toHaveLength(0);
}

describe('Validation: CreateFlightDto', () => {
  it('rejects missing flight number', async () => {
    const dto = plainToInstance(CreateFlightDto, {
      origin: 'IST',
      destination: 'JFK',
      departureDate: '2025-11-01T10:00:00.000Z',
      arrivalDate: '2025-11-01T18:00:00.000Z',
    });
    await expectInvalid(dto);
  });

  it('accepts fully populated payload', async () => {
    const dto = plainToInstance(CreateFlightDto, {
      flightNumber: 'TK1234',
      origin: 'IST',
      destination: 'JFK',
      departureDate: '2025-11-01T10:00:00.000Z',
      arrivalDate: '2025-11-01T18:00:00.000Z',
    });
    await expectValid(dto);
  });
});

describe('Validation: FlightSearchQueryDto', () => {
  it('rejects invalid IATA codes', async () => {
    const dto = plainToInstance(FlightSearchQueryDto, {
      origin: 'I',
      destination: 'JFK',
      departureDate: '2025-11-01',
    });
    await expectInvalid(dto);
  });

  it('accepts proper search parameters', async () => {
    const dto = plainToInstance(FlightSearchQueryDto, {
      origin: 'IST',
      destination: 'JFK',
      departureDate: '2025-11-01',
      adults: 2,
      currency: 'USD',
    });
    await expectValid(dto);
  });
});

describe('Validation: HotelSearchQueryDto', () => {
  it('rejects missing location', async () => {
    const dto = plainToInstance(HotelSearchQueryDto, {
      checkInDate: '2025-11-05',
      checkOutDate: '2025-11-10',
    });
    await expectInvalid(dto);
  });

  it('accepts valid hotel search parameters', async () => {
    const dto = plainToInstance(HotelSearchQueryDto, {
      location: 'istanbul',
      checkInDate: '2025-11-05',
      checkOutDate: '2025-11-10',
      guests: 2,
    });
    await expectValid(dto);
  });
});

describe('Validation: SearchQueryDto', () => {
  it('rejects empty q parameter', async () => {
    const dto = plainToInstance(SearchQueryDto, { q: '' });
    await expectInvalid(dto);
  });

  it('accepts non-empty queries', async () => {
    const dto = plainToInstance(SearchQueryDto, { q: 'dental' });
    await expectValid(dto);
  });
});

describe('Validation: EnqueueJobDto', () => {
  it('rejects missing jobType', async () => {
    const dto = plainToInstance(EnqueueJobDto, {
      payload: { caseId: 'case-1' },
    });
    await expectInvalid(dto);
  });

  it('accepts valid enqueue payload', async () => {
    const dto = plainToInstance(EnqueueJobDto, {
      jobType: 'case.followup.requested',
      payload: { caseId: 'case-1' },
    });
    await expectValid(dto);
  });
});

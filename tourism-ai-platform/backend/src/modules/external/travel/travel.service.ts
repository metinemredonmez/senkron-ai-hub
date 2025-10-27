import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AmadeusAdapter } from './amadeus.adapter';
import { SkyscannerAdapter } from './skyscanner.adapter';
import { TravelPreferencesDto } from './dto/get-travel-suggestions.dto';
import { BookItineraryDto } from './dto/book-itinerary.dto';
import { TravelPlanEntity } from '../../../database/entities/travel-plan.entity';
import { CaseEntity } from '../../../database/entities/case.entity';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { KafkaService } from '@/lib/nestjs-kafka';
import { PinoLogger } from 'nestjs-pino';
import crypto from 'crypto';
import { Redis } from 'ioredis';
import { RedisService } from '@/lib/nestjs-redis';

export interface NormalizedFlightOffer {
  id: string;
  provider: string;
  price: {
    currency: string;
    total: string;
  };
  segments: Array<{
    departure: string;
    arrival: string;
    carrierCode?: string;
  }>;
}

export interface NormalizedHotelOffer {
  id: string;
  name: string;
  provider: string;
  price: {
    currency: string;
    total: string;
  };
  rating?: number;
}

@Injectable()
export class TravelIntegrationService {
  private readonly redis: Redis;
  private readonly redisService: RedisService;

  constructor(
    private readonly amadeusAdapter: AmadeusAdapter,
    private readonly skyscannerAdapter: SkyscannerAdapter,
    @InjectRepository(TravelPlanEntity)
    private readonly travelPlanRepository: Repository<TravelPlanEntity>,
    @InjectRepository(CaseEntity)
    private readonly caseRepository: Repository<CaseEntity>,
    private readonly tenantContext: TenantContextService,
    private readonly kafkaService: KafkaService,
    private readonly logger: PinoLogger,
    redisService: RedisService,
  ) {
    this.redisService = redisService;
    this.redis = redisService.getClient();
    this.logger.setContext(TravelIntegrationService.name);
  }

  async getSuggestions(caseId: string, prefs: TravelPreferencesDto) {
    if (!caseId) {
      throw new BadRequestException('caseId query parameter is required');
    }
    const tenantId = this.tenantContext.getTenantId();
    await this.ensureCaseBelongsToTenant(caseId, tenantId);

    const adultCount = prefs.adults ? Number(prefs.adults) : 1;

    let flights: NormalizedFlightOffer[] = [];
    let hotels: NormalizedHotelOffer[] = [];
    let providerUsed = 'amadeus';

    try {
      const flightResponse = await this.amadeusAdapter.searchFlights({
        originLocationCode: prefs.originLocationCode,
        destinationLocationCode: prefs.destinationLocationCode,
        departureDate: prefs.departureDate,
        returnDate: prefs.returnDate,
        adults: adultCount,
        currencyCode: prefs.currencyCode ?? 'USD',
        max: 10,
      });
      flights = this.normalizeAmadeusFlightOffers(flightResponse);

      const hotelResponse = await this.amadeusAdapter.searchHotels({
        cityCode: prefs.destinationLocationCode,
        checkInDate: prefs.departureDate,
        checkOutDate: prefs.returnDate,
        radius: 20,
        bestRateOnly: true,
      });
      hotels = this.normalizeAmadeusHotelOffers(hotelResponse, prefs);
    } catch (error) {
      providerUsed = 'skyscanner';
      this.logger.warn(
        {
          caseId,
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Amadeus search failed, using Skyscanner fallback',
      );
      const flightResponse =
        await this.skyscannerAdapter.searchFlightsFallback({
          origin: prefs.originLocationCode,
          destination: prefs.destinationLocationCode,
          departureDate: prefs.departureDate,
          returnDate: prefs.returnDate,
          adults: adultCount,
          currency: prefs.currencyCode ?? 'USD',
        });
      flights = this.normalizeSkyscannerFlights(flightResponse);
      hotels = [];
    }

    if (!flights.length) {
      throw new ServiceUnavailableException(
        'No travel offers available for the provided preferences',
      );
    }

    const payload = {
      tenantId,
      caseId,
      provider: providerUsed,
      flightsCount: flights.length,
      hotelsCount: hotels.length,
    };

    try {
      await this.kafkaService.emit('travel.offer.generated', payload);
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          payload,
        },
        'Failed to publish travel.offer.generated event',
      );
    }

    return {
      provider: providerUsed,
      flights,
      hotels,
    };
  }

  async getItinerary(caseId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const travelPlan = await this.travelPlanRepository.findOne({
      where: { caseId, tenantId },
    });

    if (!travelPlan) {
      throw new NotFoundException('Travel itinerary not found');
    }

    return {
      caseId,
      tenantId,
      itinerary: travelPlan.itinerary ?? {},
      flights: travelPlan.flights ?? [],
      accommodations: travelPlan.accommodations ?? [],
      transfers: travelPlan.transfers ?? [],
      lastSyncedAt: travelPlan.updatedAt,
    };
  }

  async bookItinerary(
    dto: BookItineraryDto,
    idempotencyKey: string,
  ): Promise<any> {
    if (!idempotencyKey) {
      throw new BadRequestException('Missing X-Idempotency-Key header');
    }

    const tenantId = this.tenantContext.getTenantId();
    await this.ensureCaseBelongsToTenant(dto.caseId, tenantId);

    const redisKey = this.idempotencyKey(idempotencyKey, tenantId);
    const acquired = await this.redis.set(redisKey, '1', 'EX', 24 * 60 * 60, 'NX');
    if (acquired !== 'OK') {
      throw new BadRequestException(
        'Duplicate booking request detected (idempotency key already used)',
      );
    }

    try {
      const payload = {
        data: {
          type: 'flight-order',
          flightOffers: [
            {
              id: dto.offerId,
            },
          ],
          travelers: dto.passengers.map((passenger, index) => ({
            id: String(index + 1),
            dateOfBirth: dto.details?.dateOfBirth ?? '1990-01-01',
            name: {
              firstName: passenger.firstName,
              lastName: passenger.lastName,
            },
            contact: passenger.email
              ? {
                  emailAddress: passenger.email,
                }
              : undefined,
          })),
          ...dto.details,
        },
      };

      const response = await this.amadeusAdapter.bookItinerary(payload);

      const existingPlan = await this.travelPlanRepository.findOne({
        where: { caseId: dto.caseId, tenantId },
      });

      if (existingPlan) {
        existingPlan.flights = response?.data ?? existingPlan.flights;
        existingPlan.itinerary = response?.data ?? existingPlan.itinerary;
        await this.travelPlanRepository.save(existingPlan);
      } else {
        const plan = this.travelPlanRepository.create({
          tenantId,
          caseId: dto.caseId,
          flights: response?.data ?? [],
          itinerary: response?.data ?? [],
        });
        await this.travelPlanRepository.save(plan);
      }

      return {
        status: 'confirmed',
        provider: 'amadeus',
        confirmation: response,
      };
    } catch (error) {
      await this.redis.del(redisKey);
      throw error;
    }
  }

  private async ensureCaseBelongsToTenant(caseId: string, tenantId: string) {
    const medicalCase = await this.caseRepository.findOne({
      where: { id: caseId, tenantId },
    });
    if (!medicalCase) {
      throw new NotFoundException('Case not found for tenant');
    }
  }

  private normalizeAmadeusFlightOffers(raw: any): NormalizedFlightOffer[] {
    const offers = Array.isArray(raw?.data) ? raw.data : [];
    return offers.map((offer: any) => ({
      id: offer?.id ?? crypto.randomUUID(),
      provider: 'amadeus',
      price: {
        currency: offer?.price?.currency ?? 'USD',
        total: offer?.price?.total ?? '0',
      },
      segments: (offer?.itineraries ?? []).flatMap((itinerary: any) =>
        (itinerary?.segments ?? []).map((segment: any) => ({
          departure: segment?.departure?.iataCode,
          arrival: segment?.arrival?.iataCode,
          carrierCode: segment?.carrierCode,
        })),
      ),
    }));
  }

  private normalizeAmadeusHotelOffers(
    raw: any,
    prefs: TravelPreferencesDto,
  ): NormalizedHotelOffer[] {
    const offers = Array.isArray(raw?.data) ? raw.data : [];
    return offers
      .map((offer: any) => ({
        id: offer?.hotel?.hotelId ?? crypto.randomUUID(),
        provider: 'amadeus',
        name: offer?.hotel?.name ?? 'Hotel',
        price: {
          currency: offer?.offers?.[0]?.price?.currency ?? 'USD',
          total: offer?.offers?.[0]?.price?.total ?? '0',
        },
        rating: offer?.hotel?.rating
          ? Number(offer.hotel.rating)
          : undefined,
      }))
      .filter((offer: NormalizedHotelOffer) => {
        if (
          prefs.minHotelRating &&
          offer.rating &&
          offer.rating < prefs.minHotelRating
        ) {
          return false;
        }
        return true;
      });
  }

  private normalizeSkyscannerFlights(raw: any): NormalizedFlightOffer[] {
    const itineraries = Array.isArray(raw?.itineraries)
      ? raw.itineraries
      : [];
    return itineraries.map((itinerary: any) => ({
      id: itinerary?.id ?? crypto.randomUUID(),
      provider: 'skyscanner',
      price: {
        currency: itinerary?.price?.currency ?? 'USD',
        total: itinerary?.price?.amount ?? '0',
      },
      segments: (itinerary?.legs ?? []).map((leg: any) => ({
        departure: leg?.origin?.id,
        arrival: leg?.destination?.id,
        carrierCode: leg?.marketingCarrier?.id,
      })),
    }));
  }

  private idempotencyKey(key: string, tenantId: string): string {
    const hash = crypto.createHash('sha256').update(`${tenantId}:${key}`).digest('hex');
    return this.redisService.buildTenantKey(tenantId, 'travel', 'idem', hash);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Headers,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { TravelIntegrationService } from './travel.service';
import { TravelPreferencesDto } from './dto/get-travel-suggestions.dto';
import { BookItineraryDto } from './dto/book-itinerary.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TENANT_HEADER } from '../../../common/constants/app.constants';
import { TenantContextInterceptor } from '../../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../../common/interceptors/rate-limit.interceptor';

@ApiTags('external.travel')
@ApiBearerAuth()
@ApiHeader({
  name: TENANT_HEADER,
  description: 'Tenant identifier',
  required: true,
})
@UseGuards(JwtAuthGuard)
@Controller('travel')
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class ExternalTravelController {
  constructor(
    private readonly travelService: TravelIntegrationService,
  ) {}

  @Get('suggestions')
  @ApiOperation({
    summary: 'Fetch travel suggestions for a case',
    description:
      'Returns flight and optional hotel offers aggregated from Amadeus with Skyscanner fallback.',
  })
  @ApiQuery({ name: 'caseId', required: true, type: String })
  @ApiOkResponse({
    description: 'Travel suggestions successfully fetched',
    schema: {
      example: {
        provider: 'amadeus',
        flights: [
          {
            id: 'offer-01',
            provider: 'amadeus',
            price: { currency: 'USD', total: '1299.00' },
            segments: [{ departure: 'IST', arrival: 'JFK', carrierCode: 'TK' }],
          },
        ],
        hotels: [],
      },
    },
  })
  async getSuggestions(
    @Query('caseId') caseId: string,
    @Query() query: TravelPreferencesDto,
  ) {
    return this.travelService.getSuggestions(caseId, query);
  }

  @Get('itinerary/:caseId')
  @ApiOperation({
    summary: 'Retrieve saved itinerary for a case',
  })
  @ApiOkResponse({
    description: 'Itinerary payload',
    schema: {
      example: {
        caseId: 'case-42',
        tenantId: 'chat365',
        itinerary: { reference: 'TK123' },
        flights: [],
        accommodations: [],
        transfers: [],
        lastSyncedAt: '2024-05-01T10:00:00.000Z',
      },
    },
  })
  async getItinerary(@Param('caseId') caseId: string) {
    return this.travelService.getItinerary(caseId);
  }

  @Post('book')
  @ApiOperation({
    summary: 'Book an itinerary using a selected offer',
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    description: 'Idempotency key for booking operation',
    required: true,
  })
  @ApiCreatedResponse({
    description: 'Booking confirmed',
    schema: {
      example: {
        status: 'confirmed',
        provider: 'amadeus',
        confirmation: { locator: 'XYZ123', passengerCount: 2 },
      },
    },
  })
  @ApiBody({ type: BookItineraryDto })
  @ApiResponse({ status: 409, description: 'Booking already in progress' })
  async bookItinerary(
    @Body() dto: BookItineraryDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    return this.travelService.bookItinerary(dto, idempotencyKey);
  }
}

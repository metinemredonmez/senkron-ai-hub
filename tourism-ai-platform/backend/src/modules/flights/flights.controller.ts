import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FlightsService } from './flights.service';
import { FlightSearchQueryDto } from './dto/flight-search.dto';

@ApiTags('flights')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search for flight offers using Amadeus',
    description: 'Queries Amadeus flight offers API using origin, destination, and departure date.',
  })
  @ApiQuery({ name: 'origin', type: String, required: true, description: 'Origin airport IATA code' })
  @ApiQuery({ name: 'destination', type: String, required: true, description: 'Destination airport IATA code' })
  @ApiQuery({ name: 'departureDate', type: String, required: true, description: 'Departure date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'adults', type: Number, required: false, description: 'Number of adult travelers' })
  @ApiQuery({ name: 'currency', type: String, required: false, description: 'Preferred currency code' })
  @ApiResponse({
    status: 200,
    description: 'Flight offers returned from Amadeus',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', additionalProperties: true } },
        meta: { type: 'object', additionalProperties: true },
      },
    },
  })
  async search(@Query() query: FlightSearchQueryDto) {
    return this.flightsService.search(query);
  }

  @Get(':offerId')
  @ApiOperation({
    summary: 'Retrieve a single flight offer by identifier',
    description: 'Fetches a flight offer directly from Amadeus using its unique offer identifier.',
  })
  @ApiParam({
    name: 'offerId',
    description: 'Amadeus flight offer identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Flight offer details returned from Amadeus',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object', additionalProperties: true },
      },
    },
  })
  async findOne(@Param('offerId') offerId: string) {
    return this.flightsService.getById(offerId);
  }
}

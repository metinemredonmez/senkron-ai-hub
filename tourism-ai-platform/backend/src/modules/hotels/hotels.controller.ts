import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HotelsService } from './hotels.service';
import { HotelSearchQueryDto } from './dto/hotel-search.dto';

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search for hotel offers using Skyscanner',
    description: 'Queries Skyscanner hotel availability for the provided location and dates.',
  })
  @ApiQuery({ name: 'location', type: String, required: true, description: 'City or location reference supported by Skyscanner' })
  @ApiQuery({ name: 'checkInDate', type: String, required: true, description: 'Check-in date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'checkOutDate', type: String, required: true, description: 'Check-out date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'guests', type: Number, required: false, description: 'Number of guests' })
  @ApiResponse({
    status: 200,
    description: 'Hotel search results from Skyscanner',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', additionalProperties: true } },
        meta: { type: 'object', additionalProperties: true },
      },
    },
  })
  async search(@Query() query: HotelSearchQueryDto) {
    return this.hotelsService.search(query);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search across recent tenant activity' })
  @ApiQuery({ name: 'q', type: String, description: 'Free-text term to match against recent cases and bookings', required: true })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        tenantId: { type: 'string' },
        count: { type: 'number' },
        hits: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  })
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.q);
  }
}

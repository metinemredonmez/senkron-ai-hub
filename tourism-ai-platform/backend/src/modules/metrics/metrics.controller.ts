import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { MetricsDto } from './dto/metrics.dto';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Operational endpoint, no auth required' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics response',
    type: MetricsDto,
  })
  async metrics() {
    return this.metricsService.getMetrics();
  }
}

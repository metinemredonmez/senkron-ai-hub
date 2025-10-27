import { ApiProperty } from '@nestjs/swagger';

class MetricDescriptorDto {
  @ApiProperty({ description: 'Prometheus metric name', example: 'http_requests_total' })
  name: string;

  @ApiProperty({ description: 'Prometheus metric type', example: 'counter' })
  type: string;

  @ApiProperty({
    description: 'Human readable description of the metric',
    example: 'Total number of HTTP requests handled.',
  })
  help: string;
}

export class MetricsDto {
  @ApiProperty({
    description: 'Descriptors for the metrics exposed in Prometheus text format',
    type: [MetricDescriptorDto],
  })
  metrics: MetricDescriptorDto[];
}

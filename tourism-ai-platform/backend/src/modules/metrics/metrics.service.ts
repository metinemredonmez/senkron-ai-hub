import { Injectable } from '@nestjs/common';
import { PrometheusService } from '../../lib/nestjs-prometheus';

@Injectable()
export class MetricsService {
  constructor(private readonly prometheusService: PrometheusService) {}

  getContentType() {
    return this.prometheusService.getContentType();
  }

  async getMetrics(): Promise<string> {
    return this.prometheusService.getMetrics();
  }
}

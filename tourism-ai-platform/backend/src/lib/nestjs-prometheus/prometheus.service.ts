import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly registry = new client.Registry();

  constructor() {
    client.collectDefaultMetrics({ register: this.registry });
  }

  getRegistry(): client.Registry {
    return this.registry;
  }

  getContentType() {
    return this.registry.contentType;
  }

  async getMetrics() {
    return await this.registry.metrics();
  }
}

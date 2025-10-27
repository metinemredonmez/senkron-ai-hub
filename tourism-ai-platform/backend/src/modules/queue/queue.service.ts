import { Injectable } from '@nestjs/common';
import { KafkaService } from '@/lib/nestjs-kafka';
import { CASE_JOBS_TOPIC } from './queue.constants';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class QueueService {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(QueueService.name);
  }

  async enqueue(jobType: string, payload: Record<string, any>) {
    const tenantId = this.tenantContext.getTenantId();
    const event = {
      jobType,
      payload,
      tenantId,
      enqueuedAt: new Date().toISOString(),
    };

    await this.kafkaService.emit(CASE_JOBS_TOPIC, event);

    this.logger.debug(
      { jobType, tenantId },
      'Job enqueued on Kafka topic case.jobs',
    );

    return { acknowledged: true, tenantId };
  }

  describeQueue() {
    const kafkaEnabled = this.kafkaService.isEnabled();
    return {
      topic: CASE_JOBS_TOPIC,
      kafkaEnabled,
    };
  }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { EnqueueJobDto } from './dto/enqueue-job.dto';

@ApiTags('queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('jobs')
  @ApiOperation({ summary: 'Inspect pending jobs in the default queue' })
  @ApiResponse({
    status: 200,
    description: 'Kafka topic metadata',
    schema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        kafkaEnabled: { type: 'boolean' },
      },
    },
  })
  getJobs() {
    return this.queueService.describeQueue();
  }

  @Post('enqueue')
  @ApiOperation({ summary: 'Enqueue a new job for asynchronous processing' })
  @ApiBody({ type: EnqueueJobDto })
  @ApiResponse({
    status: 202,
    description: 'Job accepted for processing',
    schema: {
      type: 'object',
      properties: {
        acknowledged: { type: 'boolean', example: true },
        tenantId: { type: 'string' },
      },
    },
  })
  async enqueue(@Body() dto: EnqueueJobDto) {
    return this.queueService.enqueue(dto.jobType, dto.payload);
  }
}

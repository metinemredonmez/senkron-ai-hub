import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class EnqueueJobDto {
  @ApiProperty({ description: 'Domain-specific job type published to Kafka', example: 'case.followup.requested' })
  @IsString()
  @IsNotEmpty()
  jobType!: string;

  @ApiProperty({
    description: 'Payload to deliver alongside the job',
    type: Object,
    example: { caseId: 'case_123', priority: 'high' },
  })
  @IsObject()
  payload!: Record<string, any>;
}

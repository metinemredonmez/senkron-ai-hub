import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TenantContextService } from './tenant-context.service';
import { EventBusService } from '../services/event-bus.service';
import { AuditLogService } from '../services/audit-log.service';
import { IdempotencyService } from '../services/idempotency.service';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { RedisModule } from '@/lib/nestjs-redis';
import { EncryptionModule } from '@/lib/nestjs-encryption';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([AuditLogEntity]), RedisModule, EncryptionModule],
  providers: [
    TenantContextService,
    EventBusService,
    AuditLogService,
    IdempotencyService,
  ],
  exports: [
    TenantContextService,
    EventBusService,
    AuditLogService,
    IdempotencyService,
  ],
})
export class ContextModule {}

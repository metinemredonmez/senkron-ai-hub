import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { TenantContextService } from '../context/tenant-context.service';

export interface AuditLogInput {
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  actorId?: string;
  status?: 'SUCCESS' | 'ERROR' | 'WARNING';
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {}

  async record(input: AuditLogInput): Promise<void> {
    const tenantId = this.safeTenant();
    const log = this.repository.create({
      tenantId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      actorId: input.actorId ?? this.tenantContext.getActorId() ?? 'system',
      status: input.status ?? 'SUCCESS',
      payload: input.details ?? {},
    });
    await this.repository.save(log);
    this.logger.debug(
      { tenantId, action: input.action, resource: input.resource },
      'Audit log stored',
    );
  }

  private safeTenant(): string {
    try {
      return this.tenantContext.getTenantId();
    } catch (error) {
      this.logger.warn(
        { error },
        'Missing tenant context while recording audit log. Defaulting to system.',
      );
      return 'system';
    }
  }
}

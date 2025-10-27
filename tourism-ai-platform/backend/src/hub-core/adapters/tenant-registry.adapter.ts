import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { ContextStoreService } from '../services/context-store.service';
import { TenantDto } from '../dto/tenant.dto';

@Injectable()
export class TenantRegistryAdapter {
  private readonly logger = new Logger(TenantRegistryAdapter.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly contextStore: ContextStoreService,
    private readonly configService: ConfigService,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
  ) {
    this.ttlSeconds =
      this.configService.get<number>('hub.tenantCacheTtlSeconds') ??
      this.configService.get<number>('HUB_TENANT_CACHE_TTL_SECONDS') ??
      60 * 60 * 24;
  }

  async getTenant(tenantId: string): Promise<TenantDto> {
    const cached = await this.contextStore.getTenantContext<TenantDto>(tenantId);
    if (cached) {
      return cached;
    }

    const entity = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!entity) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    const dto = this.mapTenant(entity);
    await this.contextStore.setTenantContext(tenantId, dto as unknown as Record<string, unknown>, this.ttlSeconds);
    this.logger.debug(`Cached tenant ${tenantId} settings`);
    return dto;
  }

  private mapTenant(entity: TenantEntity): TenantDto {
    return {
      id: entity.id,
      name: entity.name,
      code: entity.code,
      settings: entity.settings ?? {},
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { RedisService } from '@/lib/nestjs-redis';
import { RegisterTenantDto } from './dto/register-tenant.dto';

export interface TenantRegistryRecord {
  tenant: TenantEntity;
  metadata: Record<string, unknown>;
}

@Injectable()
export class TenantRegistryService {
  private readonly defaultTtlSeconds = 60 * 60 * 24;

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    private readonly redis: RedisService,
  ) {}

  async listActive(): Promise<TenantRegistryRecord[]> {
    const tenants = await this.tenantRepository.find({ where: { isActive: true } });
    return Promise.all(tenants.map(async (tenant) => ({
      tenant,
      metadata: await this.getMetadata(tenant.id),
    })));
  }

  async upsert(dto: RegisterTenantDto): Promise<TenantRegistryRecord> {
    const tenant = await this.resolveTenant(dto.tenantId);
    const metadata = dto.metadata ?? {};
    await this.redis.set(
      this.registryKey(dto.tenantId),
      JSON.stringify(metadata),
      this.defaultTtlSeconds,
    );
    if (dto.settings) {
      tenant.settings = { ...(tenant.settings ?? {}), ...dto.settings };
      await this.tenantRepository.save(tenant);
    }
    return {
      tenant,
      metadata,
    };
  }

  async get(tenantId: string): Promise<TenantRegistryRecord> {
    const tenant = await this.resolveTenant(tenantId);
    const metadata = await this.getMetadata(tenantId);
    return { tenant, metadata };
  }

  private registryKey(tenantId: string): string {
    return `${tenantId}:registry:metadata`;
  }

  private async resolveTenant(tenantId: string): Promise<TenantEntity> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    return tenant;
  }

  private async getMetadata(tenantId: string): Promise<Record<string, unknown>> {
    const raw = await this.redis.get(this.registryKey(tenantId));
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
      return {};
    }
  }
}

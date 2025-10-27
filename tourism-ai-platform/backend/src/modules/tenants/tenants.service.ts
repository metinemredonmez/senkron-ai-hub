import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantsRepository: Repository<TenantEntity>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async current(): Promise<TenantEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const tenant = await this.tenantsRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async list(): Promise<TenantEntity[]> {
    return this.tenantsRepository.find();
  }

  async create(dto: CreateTenantDto): Promise<TenantEntity> {
    const tenant = this.tenantsRepository.create({
      name: dto.name,
      code: dto.code,
      settings: dto.settings ?? {},
    });
    return this.tenantsRepository.save(tenant);
  }
}

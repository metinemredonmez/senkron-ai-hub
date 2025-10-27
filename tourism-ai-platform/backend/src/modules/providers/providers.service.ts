import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderEntity } from '../../database/entities/provider.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(ProviderEntity)
    private readonly providerRepository: Repository<ProviderEntity>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async list(): Promise<ProviderEntity[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.providerRepository.find({ where: { tenantId } });
  }

  async create(dto: CreateProviderDto): Promise<ProviderEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const provider = this.providerRepository.create({
      tenantId,
      name: dto.name,
      country: dto.country,
      specialties: dto.specialties,
      accreditations: dto.accreditations ?? {},
      metadata: dto.metadata ?? {},
    });
    return this.providerRepository.save(provider);
  }

  async update(id: string, dto: UpdateProviderDto): Promise<ProviderEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const provider = await this.providerRepository.findOne({
      where: { id, tenantId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    Object.assign(provider, dto);
    return this.providerRepository.save(provider);
  }
}

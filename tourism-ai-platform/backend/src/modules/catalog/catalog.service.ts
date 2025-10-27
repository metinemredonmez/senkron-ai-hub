import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogPackageEntity } from '../../database/entities/catalog-package.entity';
import { ProviderEntity } from '../../database/entities/provider.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CatalogPackageEntity)
    private readonly catalogRepository: Repository<CatalogPackageEntity>,
    @InjectRepository(ProviderEntity)
    private readonly providerRepository: Repository<ProviderEntity>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async list(): Promise<CatalogPackageEntity[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.catalogRepository.find({
      where: { tenantId },
      relations: ['provider'],
    });
  }

  async create(dto: CreatePackageDto): Promise<CatalogPackageEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const provider = await this.providerRepository.findOne({
      where: { id: dto.providerId, tenantId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found for tenant');
    }
    const pkg = this.catalogRepository.create({
      tenantId,
      provider,
      providerId: provider.id,
      title: dto.title,
      slug: dto.slug,
      treatmentTypes: dto.treatmentTypes,
      basePrice: dto.basePrice,
      inclusions: dto.inclusions ?? {},
      exclusions: dto.exclusions ?? {},
      metadata: dto.metadata ?? {},
    });
    return this.catalogRepository.save(pkg);
  }

  async update(id: string, dto: UpdatePackageDto): Promise<CatalogPackageEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const pkg = await this.catalogRepository.findOne({
      where: { id, tenantId },
    });
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    Object.assign(pkg, dto);
    return this.catalogRepository.save(pkg);
  }
}

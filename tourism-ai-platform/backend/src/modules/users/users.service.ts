import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../database/entities/user.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantsRepository: Repository<TenantEntity>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const tenantId = this.tenantContext.getTenantId();
    return this.usersRepository.findOne({
      where: { tenantId, email: email.toLowerCase() },
      relations: ['tenant'],
    });
  }

  async findById(id: string): Promise<UserEntity | null> {
    const tenantId = this.tenantContext.getTenantId();
    return this.usersRepository.findOne({ where: { id, tenantId } });
  }

  async createUser(dto: CreateUserDto): Promise<UserEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const tenant = await this.tenantsRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    const user = this.usersRepository.create({
      tenant,
      tenantId,
      email: dto.email.toLowerCase(),
      passwordHash: await bcrypt.hash(dto.password, 12),
      roles: dto.roles,
      attributes: dto.attributes ?? {},
      isActive: true,
    });
    return this.usersRepository.save(user);
  }

  async listUsers(): Promise<UserEntity[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.usersRepository.find({ where: { tenantId } });
  }
}

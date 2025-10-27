import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserEntity } from '../../database/entities/user.entity';
import { TenantEntity } from '../../database/entities/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, TenantEntity])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}

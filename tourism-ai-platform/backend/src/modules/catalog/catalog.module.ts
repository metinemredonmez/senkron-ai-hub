import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogPackageEntity } from '../../database/entities/catalog-package.entity';
import { ProviderEntity } from '../../database/entities/provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogPackageEntity, ProviderEntity])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocsVisaController } from './docs-visa.controller';
import { DocsVisaService } from './docs-visa.service';
import { VisaDocumentEntity } from '../../database/entities/visa-document.entity';
import { CaseEntity } from '../../database/entities/case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VisaDocumentEntity, CaseEntity])],
  controllers: [DocsVisaController],
  providers: [DocsVisaService],
  exports: [DocsVisaService],
})
export class DocsVisaModule {}

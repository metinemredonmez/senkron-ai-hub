import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { PatientEntity } from '../../database/entities/patient.entity';
import { CaseEntity } from '../../database/entities/case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PatientEntity, CaseEntity])],
  providers: [PatientsService],
  controllers: [PatientsController],
  exports: [PatientsService],
})
export class PatientsModule {}

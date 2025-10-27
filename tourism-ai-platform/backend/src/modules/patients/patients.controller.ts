import { Body, Controller, Get, Param, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { PatientEntity } from '../../database/entities/patient.entity';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Create a new patient record' })
  @ApiBody({ type: CreatePatientDto })
  @ApiCreatedResponse({ type: PatientEntity })
  async create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Get()
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'List patients for the current tenant' })
  @ApiOkResponse({ type: PatientEntity, isArray: true })
  async list() {
    return this.patientsService.findAll();
  }

  @Get(':id')
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'Retrieve a patient by identifier' })
  @ApiParam({ name: 'id', description: 'Patient identifier', type: String })
  @ApiOkResponse({ type: PatientEntity })
  async find(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Put(':id')
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Update an existing patient record' })
  @ApiParam({ name: 'id', description: 'Patient identifier', type: String })
  @ApiBody({ type: UpdatePatientDto })
  @ApiOkResponse({ type: PatientEntity })
  async update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }
}

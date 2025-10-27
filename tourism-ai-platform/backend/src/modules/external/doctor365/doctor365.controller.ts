import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Doctor365Service } from './doctor365.service';
import { ProviderQueryDto } from './dto/provider-query.dto';
import { ProviderSummaryDto } from './dto/provider-response.dto';
import { SyncPatientDto } from './dto/sync-patient.dto';
import { PatientSyncResponseDto } from './dto/patient-response.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentProxyResponseDto } from './dto/appointment-response.dto';
import { PatientDealDto } from './dto/patient-deal.dto';
import { PatientFlightDataDto } from './dto/patient-flight-data.dto';
import { AppointmentDealDto } from './dto/appointment-deal.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { TENANT_HEADER } from '@/common/constants/app.constants';
import { TenantContextInterceptor } from '@/common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '@/common/interceptors/rate-limit.interceptor';

const ERROR_SCHEMA = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    error: { type: 'string' },
  },
  required: ['statusCode', 'message'],
};

@ApiTags('external.doktor365')
@ApiBearerAuth()
@ApiHeader({
  name: TENANT_HEADER,
  required: true,
  description: 'Tenant identifier (KVKK-compliant pseudonymised ID)',
})
@Controller('external/doktor365')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class Doctor365Controller {
  constructor(private readonly doktor365: Doctor365Service) {}

  @Get('providers')
  @Roles('tenant-admin', 'case-manager', 'clinician')
  @ApiOperation({
    summary: 'List provider partners available via Doktor365',
  })
  @ApiOkResponse({
    description: 'List of providers returned by Doktor365',
    type: ProviderSummaryDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    schema: ERROR_SCHEMA,
  })
  async listProviders(
    @Query() query: ProviderQueryDto,
  ): Promise<ProviderSummaryDto[]> {
    const response = await this.doktor365.listProviders(query);
    return response.providers;
  }

  @Get('patients/:doktor365Id')
  @Roles('tenant-admin', 'case-manager', 'clinician')
  @ApiOperation({
    summary: 'Fetch a patient record previously synchronized with Doktor365',
  })
  @ApiOkResponse({
    description: 'Doktor365 patient record metadata',
    type: PatientSyncResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    schema: ERROR_SCHEMA,
  })
  async getPatient(
    @Param('doktor365Id') doktor365Id: string,
  ): Promise<PatientSyncResponseDto> {
    return this.doktor365.fetchPatient(doktor365Id);
  }

  @Post('patients/sync')
  @Roles('tenant-admin', 'case-manager', 'clinician')
  @ApiOperation({
    summary: 'Create or update a Doktor365 patient record (idempotent)',
  })
  @ApiOkResponse({
    description: 'Synchronization metadata for the patient',
    type: PatientSyncResponseDto,
  })
  @ApiBody({ type: SyncPatientDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid payload supplied',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotent request in progress or consent missing',
    schema: ERROR_SCHEMA,
  })
  async synchronizePatient(
    @Body() dto: SyncPatientDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PatientSyncResponseDto> {
    return this.doktor365.synchronizePatient(dto, idempotencyKey ?? undefined);
  }

  @Post('appointments')
  @Roles('tenant-admin', 'case-manager', 'clinician')
  @ApiOperation({
    summary: 'Create a Doktor365 appointment (idempotent)',
  })
  @ApiOkResponse({
    description: 'Appointment metadata returned by Doktor365',
    type: AppointmentProxyResponseDto,
  })
  @ApiBody({ type: CreateAppointmentDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid appointment payload',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    schema: ERROR_SCHEMA,
  })
  @ApiResponse({
    status: 409,
    description: 'Appointment creation already in progress',
    schema: ERROR_SCHEMA,
  })
  async createAppointment(
    @Body() dto: CreateAppointmentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AppointmentProxyResponseDto> {
    return this.doktor365.createAppointment(dto, idempotencyKey ?? undefined);
  }

  @Post('patient/deals')
  @Roles('tenant-admin', 'case-manager', 'clinician')
  @ApiOperation({
    summary: 'Attach or update a Doktor365 patient deal',
  })
  @ApiBody({
    type: PatientDealDto,
    examples: {
      default: {
        summary: 'Sample patient deal payload',
        value: {
          doktor365PatientId: 'd365_pat_123456',
          dealId: 'D-123',
          noteType: 'text',
          notes: 'Patient accepted premium upgrade.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Patient deal recorded on Doktor365',
    schema: { example: { status: 'recorded', dealId: 'D-123' } },
  })
  async createPatientDeal(@Body() dto: PatientDealDto): Promise<Record<string, unknown>> {
    return this.doktor365.createPatientDeal(dto);
  }

  @Post('patient/ai/send-flight-data')
  @Roles('tenant-admin', 'case-manager', 'clinician')
  @ApiOperation({
    summary: 'Send curated flight itinerary details to Doktor365',
  })
  @ApiBody({
    type: PatientFlightDataDto,
    examples: {
      default: {
        summary: 'Sample flight payload',
        value: {
          doktor365PatientId: 'd365_pat_123456',
          itineraryId: 'case-42-flight-1',
          flightNumber: 'TK123',
          departureAt: '2024-05-01T08:30:00.000Z',
          arrivalAt: '2024-05-01T12:45:00.000Z',
          metadata: { airline: 'Turkish Airlines', seatClass: 'business' },
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Flight data accepted by Doktor365',
    schema: { example: { status: 'queued', reference: 'case-42-flight-1' } },
  })
  async sendFlightData(@Body() dto: PatientFlightDataDto): Promise<Record<string, unknown>> {
    return this.doktor365.sendFlightData(dto);
  }

  @Post('appointments/deals')
  @Roles('tenant-admin', 'case-manager', 'clinician')
  @ApiOperation({
    summary: 'Attach a deal to a Doktor365 appointment',
  })
  @ApiBody({
    type: AppointmentDealDto,
    examples: {
      default: {
        summary: 'Sample appointment deal payload',
        value: {
          doktor365AppointmentId: 'd365_app_456',
          dealId: 'D-456',
          noteType: 'text',
          notes: 'Appointment upgraded to VIP suite.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Appointment deal stored in Doktor365',
    schema: { example: { status: 'recorded', appointmentDealId: 'D-456' } },
  })
  async createAppointmentDeal(@Body() dto: AppointmentDealDto): Promise<Record<string, unknown>> {
    return this.doktor365.createAppointmentDeal(dto);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { BookingEntity } from '../../database/entities/booking.entity';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'List bookings' })
  @ApiOkResponse({ type: BookingEntity, isArray: true })
  async list() {
    return this.bookingsService.list();
  }

  @Post()
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Create a booking for a case' })
  @ApiBody({ type: CreateBookingDto })
  @ApiCreatedResponse({ type: BookingEntity })
  async create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  @Patch(':id')
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Update booking status' })
  @ApiParam({ name: 'id', description: 'Booking identifier', type: String })
  @ApiBody({ type: UpdateBookingStatusDto })
  @ApiOkResponse({ type: BookingEntity })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(id, dto);
  }
}

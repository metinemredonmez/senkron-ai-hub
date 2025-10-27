import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingEntity } from '../../database/entities/booking.entity';
import { CaseEntity } from '../../database/entities/case.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { EventBusService } from '../../common/services/event-bus.service';
import { PaymentClient } from '../../common/integrations/payment.client';
import { EfaturaClient } from '../../common/integrations/efatura.client';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
    @InjectRepository(CaseEntity)
    private readonly caseRepository: Repository<CaseEntity>,
    private readonly tenantContext: TenantContextService,
    private readonly eventBus: EventBusService,
    private readonly paymentClient: PaymentClient,
    private readonly efaturaClient: EfaturaClient,
  ) {}

  async list(): Promise<BookingEntity[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.bookingRepository.find({ where: { tenantId } });
  }

  async create(dto: CreateBookingDto): Promise<BookingEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const medicalCase = await this.caseRepository.findOne({
      where: { id: dto.caseId, tenantId },
    });
    if (!medicalCase) {
      throw new NotFoundException('Case not found');
    }
    const booking = this.bookingRepository.create({
      tenantId,
      case: medicalCase,
      caseId: medicalCase.id,
      status: dto.status ?? 'PENDING',
      confirmation: dto.confirmation ?? {},
      paymentInfo: dto.paymentInfo ?? {},
    });
    if (dto.paymentInfo?.generateLink) {
      const link = await this.paymentClient.generatePaymentLink({
        amount: dto.paymentInfo.amount ?? 0,
        currency: dto.paymentInfo.currency ?? 'EUR',
        reference: medicalCase.id,
        successUrl:
          dto.paymentInfo.successUrl ?? 'https://app.health-tourism.local/success',
        cancelUrl:
          dto.paymentInfo.cancelUrl ?? 'https://app.health-tourism.local/cancel',
      });
      booking.paymentInfo = {
        ...booking.paymentInfo,
        paymentLink: link.url,
      };
    }

    const saved = await this.bookingRepository.save(booking);
    if (saved.paymentInfo?.status === 'succeeded') {
      await this.eventBus.publish('payment_succeeded', {
        tenantId,
        bookingId: saved.id,
        caseId: medicalCase.id,
      });
    }
    if (dto.paymentInfo?.issueInvoice) {
      await this.efaturaClient.queueInvoice({
        caseId: medicalCase.id,
        amount: dto.paymentInfo.amount ?? 0,
        currency: dto.paymentInfo.currency ?? 'EUR',
      });
    }
    return saved;
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto): Promise<BookingEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const booking = await this.bookingRepository.findOne({
      where: { id, tenantId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    booking.status = dto.status;
    booking.confirmation = {
      ...booking.confirmation,
      notes: dto.notes ?? booking.confirmation?.notes,
    };
    const saved = await this.bookingRepository.save(booking);
    if (dto.status === 'CONFIRMED') {
      await this.eventBus.publish('booking_confirmed', {
        tenantId,
        bookingId: saved.id,
      });
    }
    return saved;
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { StripeService } from './stripe.service';
import { IyzicoService } from './iyzico.service';
import { KafkaModule } from '@/lib/nestjs-kafka';

@Module({
  imports: [ConfigModule, KafkaModule],
  controllers: [PaymentsController],
  providers: [StripeService, IyzicoService],
  exports: [StripeService, IyzicoService],
})
export class ExternalPaymentsModule {}

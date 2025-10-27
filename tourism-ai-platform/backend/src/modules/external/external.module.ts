import { Module } from '@nestjs/common';
import { CommsModule } from './comms/comms.module';
import { ExternalPaymentsModule } from './payments/payments.module';
import { ExternalTravelModule } from './travel/travel.module';
import { Doctor365Module } from './doctor365/doctor365.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AgentsModule } from './agents/agents.module';
import { OnlyChannelModule } from './only-channel/only-channel.module';

@Module({
  imports: [CommsModule, ExternalPaymentsModule, ExternalTravelModule, Doctor365Module, WebhooksModule, AgentsModule, OnlyChannelModule],
  exports: [CommsModule, ExternalPaymentsModule, ExternalTravelModule, Doctor365Module, WebhooksModule, AgentsModule, OnlyChannelModule],
})
export class ExternalModule {}

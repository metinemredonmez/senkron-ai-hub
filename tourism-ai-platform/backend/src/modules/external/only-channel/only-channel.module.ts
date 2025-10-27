import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OnlyChannelController, OnlyChannelPublicController } from './only-channel.controller';
import { OnlyChannelTokenService } from './only-channel.token.service';
import { OnlyChannelService } from './only-channel.service';
import { TenantsModule } from '../../tenants/tenants.module';
import { ContextModule } from '../../../common/context/context.module';

@Module({
  imports: [HttpModule, ConfigModule, TenantsModule, ContextModule],
  controllers: [OnlyChannelController, OnlyChannelPublicController],
  providers: [OnlyChannelService, OnlyChannelTokenService],
  exports: [OnlyChannelService, OnlyChannelTokenService],
})
export class OnlyChannelModule {}

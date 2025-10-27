import { Injectable } from '@nestjs/common';
import {
  OnlyChannelService,
  TokenResponse,
} from './only-channel.service';

@Injectable()
export class OnlyChannelTokenService {
  constructor(private readonly onlyChannelService: OnlyChannelService) {}

  async getToken(tenantId: string): Promise<TokenResponse> {
    return this.onlyChannelService.getTenantToken(tenantId);
  }

  async refreshToken(tenantId: string): Promise<TokenResponse> {
    return this.onlyChannelService.getTenantToken(tenantId, { force: true });
  }
}

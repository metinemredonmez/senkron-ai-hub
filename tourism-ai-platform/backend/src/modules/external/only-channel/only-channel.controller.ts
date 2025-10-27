import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantContextInterceptor } from '../../../common/interceptors/tenant-context.interceptor';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { OnlyChannelTokenService } from './only-channel.token.service';
import { OnlyChannelService, TokenResponse } from './only-channel.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('OnlyChannel')
@Controller('only-channel')
@UseInterceptors(TenantContextInterceptor)
export class OnlyChannelController {
  constructor(
    private readonly tokenService: OnlyChannelTokenService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('token')
  @ApiOperation({ summary: 'Retrieve the OnlyChannel token for the current tenant' })
  @ApiOkResponse({ description: 'OnlyChannel token payload', schema: { example: { tenant: 'chat365', token: 'ak_chat365_abc', expiresAt: '2024-01-01T00:00:00.000Z' } } })
  async getToken(): Promise<TokenResponse> {
    const tenantId = this.tenantContext.getTenantId();
    return this.tokenService.getToken(tenantId);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh the OnlyChannel token for the current tenant' })
  @ApiOkResponse({
    description: 'Refreshed tenant token',
    schema: {
      example: {
        tenant: 'chat365',
        token: 'ak_chat365_refreshed',
        expiresAt: '2024-02-01T00:00:00.000Z',
      },
    },
  })
  async refreshToken(): Promise<TokenResponse> {
    const tenantId = this.tenantContext.getTenantId();
    return this.tokenService.refreshToken(tenantId);
  }
}

@ApiTags('OnlyChannel')
@Controller()
@UseInterceptors(TenantContextInterceptor)
export class OnlyChannelPublicController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly onlyChannelService: OnlyChannelService,
  ) {}

  @Get('account/access-token')
  @ApiOperation({ summary: 'Retrieve and cache the OnlyChannel access token for the current tenant' })
  @ApiOkResponse({
    description: 'Tenant-scoped OnlyChannel access token',
    schema: {
      example: {
        tenant: 'chat365',
        token: 'ak_chat365_example',
        expiresAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  async getAccountAccessToken(
    @Query('refresh') refresh?: string,
  ): Promise<TokenResponse> {
    const tenantId = this.tenantContext.getTenantId();
    const force = refresh === 'true' || refresh === '1';
    return this.onlyChannelService.getAccountAccessToken(tenantId, { force });
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations for the current tenant via OnlyChannel' })
  @ApiOkResponse({
    description: 'Conversation list response',
    schema: {
      example: {
        items: [
          {
            id: 'conv_01HYGW2C8BZ6FK4',
            lastMessageAt: '2024-05-01T12:30:00.000Z',
            channel: 'whatsapp',
            participants: ['+905301112233'],
          },
        ],
        nextCursor: null,
      },
    },
  })
  async listConversations(
    @Query() query: Record<string, any>,
  ): Promise<unknown> {
    const tenantId = this.tenantContext.getTenantId();
    return this.onlyChannelService.listConversations(tenantId, query);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message through OnlyChannel for the current tenant' })
  @ApiBody({
    type: SendMessageDto,
    examples: {
      default: {
        summary: 'Plain text message',
        value: {
          conversationId: 'conv_01HYGW2C8BZ6FK4',
          content: 'Hello from Synchron AI!',
          channel: 'whatsapp',
          metadata: { locale: 'tr-TR' },
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Message queued response',
    schema: {
      example: {
        messageId: 'msg_01HYY0F5M0YB6X2',
        status: 'queued',
      },
    },
  })
  async sendMessage(@Body() payload: SendMessageDto): Promise<unknown> {
    const tenantId = this.tenantContext.getTenantId();
    return this.onlyChannelService.sendMessage(tenantId, payload);
  }
}

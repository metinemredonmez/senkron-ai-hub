import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HubService } from './hub.service';
import { HubEventDto } from './dto/event.dto';
import { AgentDto } from './dto/agent.dto';

@ApiTags('Hub')
@Controller('hub')
export class HubController {
  constructor(private readonly hubService: HubService) {}

  @Get('agents')
  @ApiOperation({ summary: 'List registered agents' })
  @ApiOkResponse({ type: [AgentDto] })
  async listAgents(): Promise<AgentDto[]> {
    return this.hubService.listAgents();
  }

  @Post('agents/register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Register or update an agent entry' })
  @ApiBody({
    type: AgentDto,
    examples: {
      default: {
        summary: 'Sample agent payload',
        value: {
          id: 'preop-agent',
          description: 'Handles patient pre-operation guidance',
          metadata: { locales: ['en', 'tr'] },
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Agent registration acknowledged', schema: { example: { status: 'accepted' } } })
  async registerAgent(@Body() agent: AgentDto): Promise<{ status: string }> {
    await this.hubService.registerAgent(agent);
    return { status: 'accepted' };
  }

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Publish an event into the Synchron AI Hub' })
  @ApiBody({
    type: HubEventDto,
    examples: {
      default: {
        summary: 'Conversation message event',
        value: {
          id: 'evt-01HY4YAYZ6S9C8',
          tenantId: 'chat365',
          type: 'conversation.message',
          source: 'onlychannel',
          timestamp: new Date().toISOString(),
          payload: { message: 'Hello from the patient' },
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Hub event queued for processing', schema: { example: { status: 'queued' } } })
  async publishEvent(@Body() body: HubEventDto): Promise<{ status: string }> {
    await this.hubService.publishEvent(body);
    return { status: 'queued' };
  }

  @Post('events/publish')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Alias for publish event endpoint used by orchestrator bridge' })
  @ApiBody({ type: HubEventDto })
  @ApiOkResponse({ description: 'Hub event queued for processing', schema: { example: { status: 'queued' } } })
  async publishEventAlias(@Body() body: HubEventDto): Promise<{ status: string }> {
    return this.publishEvent(body);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Expose hub Prometheus metrics' })
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOkResponse({
    description: 'Prometheus exposition format',
    content: {
      'text/plain': {
        example: '# HELP hub_tenant_request_total Total orchestrator routed requests by tenant and agent\n# TYPE hub_tenant_request_total counter',
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Failed to collect metrics' })
  async getMetrics(): Promise<string> {
    return this.hubService.getMetrics();
  }
}

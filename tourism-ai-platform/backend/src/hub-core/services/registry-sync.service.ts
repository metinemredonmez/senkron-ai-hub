import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { AgentDto } from '../dto/agent.dto';
import { RedisService } from '@/lib/nestjs-redis';
import { OrchestratorAdapter } from '../adapters/orchestrator.adapter';
import { TenantContextService } from '../../common/context/tenant-context.service';

interface AgentRegistryPayload {
  agents: AgentDto[];
  syncedAt: string;
}

@Injectable()
export class RegistrySyncService {
  private readonly logger = new Logger(RegistrySyncService.name);
  private readonly redis: Redis;
  private readonly cacheTtlSeconds: number;

  constructor(
    redisService: RedisService,
    private readonly orchestratorAdapter: OrchestratorAdapter,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.redis = redisService.getClient();
    this.cacheTtlSeconds =
      this.configService.get<number>('hub.registryCacheTtlSeconds') ??
      this.configService.get<number>('HUB_REGISTRY_CACHE_TTL_SECONDS') ??
      300;
  }

  async registerAgent(agent: AgentDto, tenantId?: string): Promise<void> {
    const tenantIds = this.resolveTenants(agent, tenantId);
    await Promise.all(
      tenantIds.map(async (id) => {
        const agents = await this.listAgents(false, id);
        const index = agents.findIndex((item) => item.id === agent.id || item.name === agent.name);
        if (index >= 0) {
          agents[index] = agent;
        } else {
          agents.push(agent);
        }
        await this.writeRegistry(id, agents);
        this.logger.log(`Registered agent ${agent.name} for tenant ${id}`);
      }),
    );
  }

  async listAgents(forceRefresh = false, tenantId?: string): Promise<AgentDto[]> {
    const resolvedTenantId = this.resolveTenant(tenantId);
    const registryKey = this.registryKey(resolvedTenantId);

    if (!forceRefresh) {
      const cached = await this.redis.get(registryKey);
      if (cached) {
        try {
          const payload = JSON.parse(cached) as AgentRegistryPayload;
          return payload.agents ?? [];
        } catch (error) {
          this.logger.warn('Failed to parse cached agent registry', error as Error);
        }
      }
    }

    try {
      const agents = await this.orchestratorAdapter.listAgents(resolvedTenantId);
      await this.writeRegistry(resolvedTenantId, agents);
      return agents;
    } catch (error) {
      this.logger.error(
        `Failed to fetch agents from orchestrator for tenant ${resolvedTenantId}`,
        error as Error,
      );
      const agents = await this.orchestratorAdapter.listAgents();
      if (agents.length) {
        await this.writeRegistry(resolvedTenantId, agents);
        return agents;
      }
      const cached = await this.redis.get(registryKey);
      if (cached) {
        const payload = JSON.parse(cached) as AgentRegistryPayload;
        return payload.agents ?? [];
      }
      return [];
    }
  }

  private async writeRegistry(tenantId: string, agents: AgentDto[]): Promise<void> {
    const payload: AgentRegistryPayload = {
      agents,
      syncedAt: new Date().toISOString(),
    };
    await this.redis.set(this.registryKey(tenantId), JSON.stringify(payload), 'EX', this.cacheTtlSeconds);
  }

  private registryKey(tenantId: string): string {
    return `${tenantId}:hub:registry:agents`;
  }

  private resolveTenant(tenantId?: string): string {
    if (tenantId) {
      return tenantId;
    }
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'system';
    }
  }

  private resolveTenants(agent: AgentDto, tenantId?: string): string[] {
    const scopedTenant = tenantId ?? this.safeTenantId();
    const fromAgent = Array.isArray(agent.tenants) && agent.tenants.length > 0 ? agent.tenants : [scopedTenant];
    const tenants = fromAgent
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value && value !== 'system'));
    if (!tenants.length) {
      tenants.push(scopedTenant);
    }
    return Array.from(new Set(tenants));
  }

  private safeTenantId(): string {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'system';
    }
  }
}

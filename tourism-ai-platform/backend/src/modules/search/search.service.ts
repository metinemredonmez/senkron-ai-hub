import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '@/lib/nestjs-redis';
import { TenantContextService } from '../../common/context/tenant-context.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async search(term: string) {
    const tenantId = this.tenantContext.getTenantId();
    const indexKey = `search:index:${tenantId}`;
    const client = this.redisService.getClient();
    let entries: string[] = [];
    try {
      entries = await client.zrevrange(indexKey, 0, 49);
    } catch (error) {
      this.logger.error(
        { indexKey, error: (error as Error)?.message ?? String(error) },
        'Failed to read search index from Redis',
      );
      throw new ServiceUnavailableException('Search index is currently unavailable');
    }

    const normalized = term?.trim().toLowerCase() ?? '';
    const hits = entries
      .map((entry) => {
        try {
          return JSON.parse(entry) as Record<string, unknown>;
        } catch {
          this.logger.warn({ entry }, 'Discarding invalid search index entry');
          return undefined;
        }
      })
      .filter((record): record is Record<string, unknown> => Boolean(record))
      .filter((record) => {
        if (!normalized) {
          return true;
        }
        return JSON.stringify(record).toLowerCase().includes(normalized);
      });

    return {
      query: term,
      tenantId,
      hits,
      count: hits.length,
    };
  }
}

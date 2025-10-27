import { SetMetadata } from '@nestjs/common';

export const SKIP_RATE_LIMIT_METADATA_KEY = 'rateLimit:skip';

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_METADATA_KEY, true);

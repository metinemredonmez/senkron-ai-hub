import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const syncTravelSchema = z.object({
  preferences: z.record(z.any()).optional(),
});

export class SyncTravelDto extends createZodDto(syncTravelSchema) {}

export type SyncTravelInput = z.infer<typeof syncTravelSchema>;

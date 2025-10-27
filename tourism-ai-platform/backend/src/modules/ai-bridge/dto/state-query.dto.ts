import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const stateQuerySchema = z.object({
  tenantId: z.string().uuid(),
});

export class StateQueryDto extends createZodDto(stateQuerySchema) {}

export type StateQueryInput = z.infer<typeof stateQuerySchema>;

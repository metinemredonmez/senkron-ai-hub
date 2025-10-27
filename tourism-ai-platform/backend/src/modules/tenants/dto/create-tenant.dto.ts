import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createTenantSchema = z.object({
  code: z.string().min(3).max(64),
  name: z.string().min(3).max(255),
  settings: z.record(z.any()).optional(),
});

export class CreateTenantDto extends createZodDto(createTenantSchema) {}

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

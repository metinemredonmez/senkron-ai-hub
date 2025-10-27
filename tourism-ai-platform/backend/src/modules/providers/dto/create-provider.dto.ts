import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createProviderSchema = z.object({
  name: z.string().min(3).max(255),
  country: z.string().min(2).max(120),
  specialties: z.array(z.string()).min(1),
  accreditations: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export class CreateProviderDto extends createZodDto(createProviderSchema) {}

export type CreateProviderInput = z.infer<typeof createProviderSchema>;

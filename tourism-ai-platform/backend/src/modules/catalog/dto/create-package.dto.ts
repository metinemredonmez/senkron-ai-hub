import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPackageSchema = z.object({
  providerId: z.string().uuid(),
  title: z.string().min(3).max(255),
  slug: z.string().min(3).max(255),
  treatmentTypes: z.array(z.string()).min(1),
  basePrice: z.number().positive(),
  inclusions: z.record(z.any()).optional(),
  exclusions: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export class CreatePackageDto extends createZodDto(createPackageSchema) {}

export type CreatePackageInput = z.infer<typeof createPackageSchema>;

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createCaseSchema = z.object({
  patientId: z.string().uuid(),
  title: z.string().min(3).max(255),
  targetProcedure: z.string().min(3).max(255),
  symptoms: z.array(z.string()).optional(),
  documents: z.array(z.string()).optional(),
  travelPreferences: z.record(z.any()).optional(),
  budget: z
    .object({
      currency: z.string().default('EUR'),
      maxAmount: z.number().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export class CreateCaseDto extends createZodDto(createCaseSchema) {}

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

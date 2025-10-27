import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createQuoteSchema = z.object({
  caseId: z.string().uuid(),
  adjustments: z.record(z.any()).optional(),
});

export class CreateQuoteDto extends createZodDto(createQuoteSchema) {}

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

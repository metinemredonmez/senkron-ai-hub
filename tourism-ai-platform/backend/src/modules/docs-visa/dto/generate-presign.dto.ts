import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const generatePresignSchema = z.object({
  caseId: z.string().uuid(),
  fileName: z.string().min(3),
  mimeType: z.string().min(3),
});

export class GeneratePresignDto extends createZodDto(generatePresignSchema) {}

export type GeneratePresignInput = z.infer<typeof generatePresignSchema>;

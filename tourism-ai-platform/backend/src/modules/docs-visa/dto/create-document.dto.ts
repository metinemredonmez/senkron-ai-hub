import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createDocumentSchema = z.object({
  caseId: z.string().uuid(),
  documentType: z.string().min(3).max(64),
  storageKey: z.string().min(3),
  presignedUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export class CreateDocumentDto extends createZodDto(createDocumentSchema) {}

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

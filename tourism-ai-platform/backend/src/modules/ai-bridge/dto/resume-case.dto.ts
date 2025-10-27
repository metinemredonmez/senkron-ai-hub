import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const resumeCaseSchema = z.object({
  caseId: z.string().uuid(),
  tenantId: z.string().uuid(),
  taskId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(500).optional(),
});

export class ResumeCaseDto extends createZodDto(resumeCaseSchema) {}

export type ResumeCaseInput = z.infer<typeof resumeCaseSchema>;

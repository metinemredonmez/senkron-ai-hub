import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const resolveApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(1024).optional(),
});

export class ResolveApprovalDto extends createZodDto(resolveApprovalSchema) {}

export type ResolveApprovalInput = z.infer<typeof resolveApprovalSchema>;

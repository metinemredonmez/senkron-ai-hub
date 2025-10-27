import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const sendTemplateMessageSchema = z.object({
  caseId: z.string().uuid().optional(),
  to: z.string().min(6),
  templateName: z.string().min(3),
  params: z.array(z.string().min(1)).default([]),
  locale: z.string().min(2).max(10).default('en_US'),
  metadata: z.record(z.any()).optional(),
});

export class SendTemplateMessageDto extends createZodDto(
  sendTemplateMessageSchema,
) {}

export type SendTemplateMessageInput = z.infer<
  typeof sendTemplateMessageSchema
>;

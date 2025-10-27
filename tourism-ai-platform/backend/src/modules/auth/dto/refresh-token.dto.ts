import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export class RefreshTokenDto extends createZodDto(refreshSchema) {}

export type RefreshInput = z.infer<typeof refreshSchema>;

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(z.string()).min(1),
  attributes: z.record(z.any()).optional(),
});

export class CreateUserDto extends createZodDto(createUserSchema) {}

export type CreateUserInput = z.infer<typeof createUserSchema>;

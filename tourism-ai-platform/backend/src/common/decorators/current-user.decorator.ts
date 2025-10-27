import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  email: string;
  roles: string[];
  tenantId: string;
  scopes?: string[];
  attributes?: Record<string, any>;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): RequestUser | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);

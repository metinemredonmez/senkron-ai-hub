import { SetMetadata } from '@nestjs/common';
import { RequestUser } from './current-user.decorator';

export type PolicyHandler = (user: RequestUser, resource?: any) => boolean;

export const POLICIES_KEY = 'policies';

export const Policies = (...handlers: PolicyHandler[]) =>
  SetMetadata(POLICIES_KEY, handlers);

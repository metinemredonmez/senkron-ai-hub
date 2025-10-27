import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { POLICIES_KEY, PolicyHandler } from '../decorators/policies.decorator';
import { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(
      POLICIES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!handlers || handlers.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user as
      | RequestUser
      | undefined;
    if (!user) {
      return false;
    }
    if (this.isAdmin(user)) {
      return true;
    }

    if (!this.passesPatientAbac(user, request)) {
      return false;
    }

    const resourceContext = {
      params: request.params,
      body: request.body,
      query: request.query,
      tenantId: request.headers['x-tenant'] ?? user.tenantId,
    };

    return handlers.every((handler) => handler(user, resourceContext));
  }

  private isAdmin(user: RequestUser): boolean {
    return (
      user.roles?.some((role) => role.toLowerCase() === 'admin') ||
      user.scopes?.includes('admin:*')
    );
  }

  private passesPatientAbac(user: RequestUser, request: any): boolean {
    if (!user.roles?.some((role) => role.toLowerCase() === 'patient')) {
      return true;
    }
    const targetPatientId =
      request.params?.patientId ??
      request.body?.patientId ??
      request.query?.patientId ??
      request.params?.id;
    if (targetPatientId && targetPatientId !== user.id) {
      return false;
    }
    return true;
  }
}

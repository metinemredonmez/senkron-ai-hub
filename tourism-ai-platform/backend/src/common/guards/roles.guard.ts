import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    const userRoles: string[] = user.roles ?? [];
    const hasRole = requiredRoles.some((role) =>
      userRoles.some((userRole: string) =>
        userRole.toLowerCase() === role.toLowerCase(),
      ),
    );
    if (hasRole) {
      return true;
    }

    const isAdmin = userRoles.some(
      (role: string) => role.toLowerCase() === 'admin',
    );
    if (isAdmin || (user.scopes ?? []).includes('admin:*')) {
      return true;
    }

    throw new ForbiddenException('Insufficient user role');
  }
}

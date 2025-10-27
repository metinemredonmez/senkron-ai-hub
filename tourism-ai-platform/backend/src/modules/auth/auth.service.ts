import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { UserEntity } from '../../database/entities/user.entity';

interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  tenantId: string;
  scopes: string[];
  attributes?: Record<string, any>;
}

const ROLE_SCOPES: Record<string, string[]> = {
  admin: ['admin:*', 'doctor:*', 'patient:*', 'cases:write', 'cases:read'],
  doctor: ['doctor:*', 'cases:read', 'patients:read', 'care:write'],
  patient: ['patient:*', 'profile:read', 'profile:update'],
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserEntity> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('User is disabled');
    }
    return user;
  }

  private buildPayload(input: {
    id: string;
    email: string;
    roles: string[];
    tenantId: string;
  }): TokenPayload {
    const scopes = this.deriveScopes(input.roles);
    return {
      sub: input.id,
      email: input.email,
      roles: input.roles,
      tenantId: input.tenantId,
      scopes,
      attributes: {
        userId: input.id,
        tenantId: input.tenantId,
      },
    };
  }

  private deriveScopes(roles: string[]): string[] {
    const scopeSet = new Set<string>();
    for (const role of roles ?? []) {
      const normalized = role.toLowerCase();
      const mapped = ROLE_SCOPES[normalized];
      if (mapped && mapped.length) {
        mapped.forEach((scope) => scopeSet.add(scope));
      }
    }
    if (scopeSet.size === 0) {
      scopeSet.add('patient:readonly');
    }
    return Array.from(scopeSet);
  }

  private async generateTokens(payload: TokenPayload) {
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }

  async login(user: UserEntity) {
    const tenantId = this.tenantContext.getTenantId();
    const payload = this.buildPayload({
      id: user.id,
      email: user.email,
      roles: user.roles,
      tenantId,
    });
    const tokens = await this.generateTokens(payload);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        scopes: payload.scopes,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = await this.jwtService.verifyAsync<TokenPayload>(
        refreshToken,
      );
      const tenantId = this.tenantContext.getTenantId();
      if (decoded.tenantId !== tenantId) {
        throw new UnauthorizedException('Tenant mismatch for refresh token');
      }
      const tokens = await this.generateTokens(decoded);
      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}

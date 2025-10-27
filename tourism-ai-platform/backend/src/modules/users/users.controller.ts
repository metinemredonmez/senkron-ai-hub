import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { UserEntity } from '../../database/entities/user.entity';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List users for the current tenant' })
  @ApiOkResponse({ type: UserEntity, isArray: true })
  async list() {
    return this.usersService.listUsers();
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new user within the current tenant' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ type: UserEntity })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }
}

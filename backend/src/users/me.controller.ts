import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ProfileDto } from './dto/profile.dto';
import { toUserDto, type UserDto } from './user.mapper';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  /** The guard already loaded the fresh, active user — return it directly. */
  @Get()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ operationId: 'getMe', summary: 'getMe', description: 'Access: authenticated.' })
  getMe(@CurrentUser() user: AuthenticatedUser): UserDto {
    return toUserDto(user);
  }

  @Patch()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ operationId: 'updateMe', summary: 'updateMe', description: 'Access: authenticated.' })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProfileDto,
  ): Promise<UserDto> {
    return this.users.updateDisplayName(user.id, dto.displayName);
  }
}

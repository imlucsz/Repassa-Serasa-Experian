import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { toUserDto, type UserDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateDisplayName(userId: string, displayName: string): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName },
    });
    return toUserDto(user);
  }
}

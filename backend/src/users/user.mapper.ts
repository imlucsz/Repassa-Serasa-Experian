import type { Role, User } from '@prisma/client';

/** Contract `User` schema — never leaks passwordHash or internal fields. */
export interface UserDto {
  id: string;
  displayName: string;
  email: string;
  role: Role;
}

export function toUserDto(
  user: Pick<User, 'id' | 'displayName' | 'email' | 'role'>,
): UserDto {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
  };
}

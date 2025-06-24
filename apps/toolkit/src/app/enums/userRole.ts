export const UserRole = {
  user: 'User',
  admin: 'Admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
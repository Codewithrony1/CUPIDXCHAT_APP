import { z } from 'zod';

export const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'system',
  'cupidx',
  'official',
  'support',
  'help',
  'security',
  'root',
  'mod',
  'moderator',
  'api',
  'null',
  'undefined',
  'guest',
];

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  )
  .refine(
    (val) => !val.includes(' '),
    'Username cannot contain spaces'
  )
  .refine(
    (val) => !RESERVED_USERNAMES.includes(val.toLowerCase()),
    'This username is reserved and cannot be used'
  );

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase());
}

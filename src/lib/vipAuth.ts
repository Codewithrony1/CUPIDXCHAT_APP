import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { getCurrentUser } from './auth';

export {
  RESERVED_USERNAMES,
  DEFAULT_BIO,
  isUserVip,
  validateUsernameFormat,
  getCanonicalPair,
} from './vipCommon';
import { isUserVip } from './vipCommon';

export async function requireVipUser(req?: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 }),
    };
  }

  if (user.isSuspended) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Account suspended.' }, { status: 403 }),
    };
  }

  const isVip = isUserVip(user);
  if (!isVip) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error: 'CupidX VIP membership required to access this feature.',
          isVipRequired: true,
        },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

export async function requireAuthUser(req?: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 }),
    };
  }

  if (user.isSuspended) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Account suspended.' }, { status: 403 }),
    };
  }

  return { user, response: null };
}

export async function checkBlockBetween(userIdA: string, userIdB: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    },
  });
  return Boolean(block);
}

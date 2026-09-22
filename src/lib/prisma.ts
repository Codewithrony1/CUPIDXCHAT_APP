import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createMockPrisma(): PrismaClient {
  const createModelHandler = () => {
    const handler: Record<string, any> = {
      findMany: async () => [],
      findFirst: async (args?: any) => (args?.where?.id ? { id: args.where.id, ...args?.where } : null),
      findUnique: async (args?: any) => (args?.where?.id ? { id: args.where.id, ...args?.where } : null),
      create: async (d: any) => ({
        id: 'mock-' + Math.random().toString(36).slice(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(d?.data ?? {}),
      }),
      createMany: async (d: any) => ({ count: Array.isArray(d?.data) ? d.data.length : 1 }),
      update: async (d: any) => ({
        id: d?.where?.id ?? 'mock-id',
        updatedAt: new Date(),
        ...(d?.data ?? {}),
      }),
      updateMany: async () => ({ count: 1 }),
      delete: async (d: any) => ({ id: d?.where?.id ?? 'mock-id' }),
      deleteMany: async () => ({ count: 0 }),
      upsert: async (d: any) => ({
        id: d?.where?.id ?? 'mock-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(d?.create ?? d?.update ?? {}),
      }),
      count: async () => 0,
      aggregate: async () => ({ _count: 0, _avg: {}, _sum: {}, _min: {}, _max: {} }),
      groupBy: async () => [],
    };

    return new Proxy(handler, {
      get: (target, prop: string) => {
        if (prop in target) return target[prop];
        return async () => null;
      },
    });
  };

  const mockPrisma: any = new Proxy({}, {
    get: (_target, prop: string) => {
      if (prop === '$connect' || prop === '$disconnect') return async () => {};
      if (prop === '$transaction') return async (fnOrArr: any) => (typeof fnOrArr === 'function' ? fnOrArr(mockPrisma) : Promise.all(fnOrArr));
      return createModelHandler();
    },
  });

  return mockPrisma as unknown as PrismaClient;
}

function getConnectionString(): string | null {
  const connectionString =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  return connectionString || null;
}

function cleanConnectionString(raw: string): string {
  let url = raw;
  if (/sslmode=/i.test(url)) {
    url = url.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
  } else {
    url += (url.includes('?') ? '&' : '?') + 'sslmode=no-verify';
  }
  return url;
}

function createPrismaClient(): PrismaClient {
  const rawConnectionString = getConnectionString();
  if (!rawConnectionString) {
    console.warn('[AI Studio] Database not connected — using mock');
    return createMockPrisma();
  }

  try {
    const needsSsl =
      rawConnectionString.includes('supabase.co') ||
      rawConnectionString.includes('pooler.supabase.com') ||
      rawConnectionString.includes('sslmode=require') ||
      process.env.NODE_ENV === 'production';

    if (needsSsl && typeof process !== 'undefined') {
      // 1. Prevent Node TLS rejection of Supabase pooler intermediate/self-signed certs in serverless
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      // 2. Set PGSSLMODE to no-verify so pg connection-parameters defaults rejectUnauthorized to false
      process.env.PGSSLMODE = 'no-verify';
    }

    const connectionString = needsSsl ? cleanConnectionString(rawConnectionString) : rawConnectionString;

    const pool =
      globalForPrisma.pgPool ??
      new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.pgPool = pool;
    }

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  } catch (err: any) {
    console.warn('[AI Studio] Failed to initialize PrismaClient — using mock fallback:', err?.message || err);
    return createMockPrisma();
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;


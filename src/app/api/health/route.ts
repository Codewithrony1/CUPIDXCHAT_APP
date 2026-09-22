import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'disconnected';
  let dbLatencyMs = -1;

  let dbHost = 'unknown';
  let dbProtocol = 'unknown';
  try {
    const rawUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (rawUrl) {
      const u = new URL(rawUrl);
      dbHost = u.host;
      dbProtocol = u.protocol;
    } else {
      dbHost = 'NO_ENV_SET';
    }
  } catch {
    dbHost = 'PARSE_ERROR';
  }

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1 as health_check`;
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = 'connected';

    // Verify User table exists in PostgreSQL
    try {
      await prisma.user.findFirst({ select: { id: true } });
    } catch (tableErr: any) {
      if (String(tableErr?.message || tableErr).includes('does not exist')) {
        console.log('[HEALTH] User table missing. Executing ensurePgSchema()...');
        const { ensurePgSchema } = await import('../../../../prisma/ensure-pg-schema.js');
        await ensurePgSchema();
        await prisma.user.findFirst({ select: { id: true } });
      } else {
        throw tableErr;
      }
    }
  } catch (err: any) {
    dbStatus = `error: ${err?.message || String(err)}`;
  }

  const mem = process.memoryUsage();
  const isHealthy = dbStatus === 'connected';

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        host: dbHost,
        protocol: dbProtocol,
      },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      responseTimeMs: Date.now() - startTime,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function ensurePgSchema() {
  const rawUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;

  if (!rawUrl || (!rawUrl.startsWith('postgres://') && !rawUrl.startsWith('postgresql://'))) {
    console.log('[PG SCHEMA] Non-Postgres database detected, skipping Postgres schema ensure.');
    return;
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  process.env.PGSSLMODE = 'no-verify';

  // Prepare clean connection URL with sslmode=no-verify
  let url = rawUrl;
  if (/sslmode=/i.test(url)) {
    url = url.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
  } else {
    url += (url.includes('?') ? '&' : '?') + 'sslmode=no-verify';
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    console.log('[PG SCHEMA] Connecting to PostgreSQL database...');
    await client.connect();

    // Check if "User" table exists
    const checkRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'User'
      ) as exists;
    `);

    const userTableExists = checkRes.rows[0]?.exists === true;

    if (userTableExists) {
      console.log('[PG SCHEMA] User table already exists. Database schema verified.');
      return;
    }

    console.log('[PG SCHEMA] User table does not exist. Initializing schema from prisma/schema.sql...');
    const sqlPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('[PG SCHEMA ERROR] prisma/schema.sql not found!');
      return;
    }

    const ddl = fs.readFileSync(sqlPath, 'utf8');
    await client.query(ddl);
    console.log('[PG SCHEMA] Successfully executed schema.sql! All tables created.');
  } catch (err) {
    console.error('[PG SCHEMA ERROR]:', err.message || err);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

if (require.main === module) {
  ensurePgSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(0);
    });
}

module.exports = { ensurePgSchema };

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const columnQuery = `
  SELECT data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'rewards_external'
    AND table_name = 'merchant_deals' AND column_name = 'display_order'
`;

// A single, explicitly approved external-production migration, not a generic
// migration runner. Never import the application or fall back to its dev DB.
export async function migrate(client, sql) {
  let transaction = false;
  try {
    await client.connect();
    await client.query('BEGIN');
    transaction = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const target = await client.query(
      "SELECT to_regclass('rewards_external.merchant_deals') AS target",
    );
    if (!target.rows[0]?.target) throw new Error('TARGET_MISSING');
    await client.query(sql);
    const { rows } = await client.query(columnQuery);
    const column = rows[0];
    if (
      column?.data_type !== 'integer' ||
      column.is_nullable !== 'NO' ||
      !/^(?:0|'0'::integer)$/.test(column.column_default ?? '')
    ) throw new Error('COLUMN_VERIFICATION_FAILED');
    await client.query('COMMIT');
    transaction = false;
  } catch (error) {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

export function connectionConfig(env) {
  const connectionString = env.PRODUCTION_DATABASE_URL;
  if (!connectionString) throw new Error('MISSING_PRODUCTION_DATABASE_URL');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('INVALID_DATABASE_PROTOCOL');
  }
  // Require verified TLS. Do not inherit sslmode=no-verify/disable from a URL.
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('ssl')) url.searchParams.delete(key);
  }
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
    query_timeout: 45000,
    application_name: 'github-deal-order-migration',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = connectionConfig(process.env);
    const sql = await readFile(new URL('../migrations/merchant-deal-order.sql', import.meta.url), 'utf8');
    await migrate(new pg.Client(config), sql);
    console.log('Verified rewards_external.merchant_deals.display_order; deployment may proceed.');
  } catch {
    // Connection errors can contain credentials or database addresses. Do not
    // dump error objects, connection strings, SQL results or environment values.
    console.error('Deal-order migration failed. Deployment is blocked. Check PRODUCTION_DATABASE_URL, verified TLS, network access, DDL permissions and the rewards_external schema. No automatic retry.');
    process.exitCode = 1;
  }
}

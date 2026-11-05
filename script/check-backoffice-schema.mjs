import pg from 'pg';
import { pathToFileURL } from 'node:url';

export async function checkBackofficeSchema(client) {
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '15s'");
    const { rows } = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'rewards_external'
        AND table_name IN ('merchants', 'deals', 'merchant_deals', 'system_settings')
    `);
    const columns = new Map(rows.map((row) => [`${row.table_name}.${row.column_name}`, row.data_type]));
    for (const [table, id] of [['merchants', 'backoffice_merchant_id'], ['deals', 'backoffice_offer_id'], ['merchant_deals', 'backoffice_offer_id']]) {
      for (const [column, type] of [[id, 'text'], ['backoffice_created_at', 'timestamp without time zone'], ['last_backoffice_error', 'text'], ['last_backoffice_attempt_at', 'timestamp without time zone']]) {
        if (columns.get(`${table}.${column}`) !== type) throw new Error('BACKOFFICE_SCHEMA_NOT_READY');
      }
    }
    if (!columns.has('system_settings.key') || !columns.has('system_settings.value')) throw new Error('SETTINGS_TABLE_NOT_READY');
    await client.query('ROLLBACK');
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.PRODUCTION_DATABASE_URL) throw new Error('MISSING_PRODUCTION_DATABASE_URL');
    const url = new URL(process.env.PRODUCTION_DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('INVALID_PROTOCOL');
    for (const key of [...url.searchParams.keys()]) if (key.toLowerCase().startsWith('ssl')) url.searchParams.delete(key);
    await checkBackofficeSchema(new pg.Client({
      connectionString: url.toString(), ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 15000, query_timeout: 20000,
      application_name: 'github-backoffice-schema-preflight',
    }));
    console.log('Production backoffice schema verified (read-only).');
  } catch {
    console.error('Production backoffice preflight failed. Deployment blocked. Check the PRODUCTION_DATABASE_URL GitHub secret, approved network/TLS access, and the reviewed rewards_external backoffice migration. No schema changes were attempted.');
    process.exitCode = 1;
  }
}

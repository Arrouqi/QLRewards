import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { connectionConfig, migrate } from './migrate-deal-order.mjs';

const sql = await readFile(new URL('../migrations/merchant-deal-order.sql', import.meta.url), 'utf8');
function fixture({ target = true, column = {}, failSql = false } = {}) {
  const calls = [];
  return {
    calls,
    async connect() { calls.push('connect'); },
    async end() { calls.push('end'); },
    async query(query) {
      calls.push(query);
      if (query.includes('to_regclass')) return { rows: [{ target: target ? 'rewards_external.merchant_deals' : null }] };
      if (query === sql && failSql) throw new Error('simulated DDL failure');
      if (query.includes('information_schema.columns')) {
        return { rows: [{ data_type: 'integer', is_nullable: 'NO', column_default: '0', ...column }] };
      }
      return { rows: [] };
    },
  };
}
test('no production secret means no fallback to development', () => {
  assert.throws(() => connectionConfig({ DATABASE_URL: 'postgres://example/test' }), /MISSING/);
});
test('requires PostgreSQL and verified TLS with bounded connection time', () => {
  assert.throws(() => connectionConfig({ PRODUCTION_DATABASE_URL: 'https://example.test' }), /PROTOCOL/);
  const config = connectionConfig({ PRODUCTION_DATABASE_URL: 'postgres://example.test/db?sslmode=no-verify' });
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
  assert.equal(config.connectionTimeoutMillis, 15000);
});
test('migration targets only the production schema and is repeatable', async () => {
  assert.match(sql, /ALTER TABLE rewards_external\.merchant_deals/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS display_order/);
  assert.doesNotMatch(sql, /\b(?:DROP|DELETE|UPDATE|TRUNCATE)\b/i);
  for (let run = 0; run < 2; run++) {
    const client = fixture();
    await migrate(client, sql);
    assert.ok(client.calls.includes('COMMIT'));
    assert.ok(!client.calls.includes('ROLLBACK'));
    assert.equal(client.calls.at(-1), 'end');
  }
});
test('missing target stops before DDL and rolls back', async () => {
  const client = fixture({ target: false });
  await assert.rejects(migrate(client, sql), /TARGET_MISSING/);
  assert.ok(!client.calls.includes(sql));
  assert.ok(client.calls.includes('ROLLBACK'));
});
test('DDL errors roll back and never commit', async () => {
  const client = fixture({ failSql: true });
  await assert.rejects(migrate(client, sql));
  assert.ok(client.calls.includes('ROLLBACK'));
  assert.ok(!client.calls.includes('COMMIT'));
});
test('incompatible existing column blocks deployment and rolls back', async () => {
  for (const column of [{ data_type: 'text' }, { is_nullable: 'YES' }, { column_default: '1' }]) {
    const client = fixture({ column });
    await assert.rejects(migrate(client, sql), /COLUMN_VERIFICATION_FAILED/);
    assert.ok(client.calls.includes('ROLLBACK'));
    assert.ok(!client.calls.includes('COMMIT'));
  }
});

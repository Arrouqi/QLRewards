import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBackofficeSchema } from './check-backoffice-schema.mjs';

function fixture(omit) {
  const calls = [];
  const rows = [];
  for (const table of ['merchants', 'deals', 'merchant_deals']) {
    const id = table === 'merchants' ? 'backoffice_merchant_id' : 'backoffice_offer_id';
    for (const [column_name, data_type] of [[id, 'text'], ['backoffice_created_at', 'timestamp without time zone'], ['last_backoffice_error', 'text'], ['last_backoffice_attempt_at', 'timestamp without time zone']]) {
      rows.push({ table_name: table, column_name, data_type });
    }
  }
  rows.push({ table_name: 'system_settings', column_name: 'key' }, { table_name: 'system_settings', column_name: 'value' });
  return {
    calls, async connect() {}, async end() { calls.push('end'); },
    async query(sql) { calls.push(sql); return { rows: rows.filter((row) => `${row.table_name}.${row.column_name}` !== omit) }; },
  };
}
test('preflight succeeds using read-only queries without DDL', async () => {
  const client = fixture();
  await checkBackofficeSchema(client);
  assert.ok(client.calls.includes('BEGIN READ ONLY'));
  assert.ok(client.calls.includes('ROLLBACK'));
  assert.ok(!client.calls.some((sql) => /\b(ALTER|INSERT|UPDATE|DELETE|CREATE|DROP)\b/.test(sql)));
  assert.equal(client.calls.at(-1), 'end');
});
test('missing migration or settings table blocks release and closes connection', async () => {
  for (const column of ['merchants.backoffice_merchant_id', 'deals.last_backoffice_error', 'merchant_deals.backoffice_offer_id', 'system_settings.key']) {
    const client = fixture(column);
    await assert.rejects(checkBackofficeSchema(client));
    assert.equal(client.calls.at(-1), 'end');
  }
});

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { createApi } from '../server/api.js';

const header = 'Order ID,Order Date,Customer ID,Product Category,Region,Sales Amount\n';
const order = 'CAPSTONE-001,2026-12-01,CUST-NEW,"Office, Home",South,1250.25\n';

async function serve(databasePath, run) {
  const { api, close } = createApi({ databasePath, importToken: 'test-token' });
  const app = express();
  app.use('/api', api);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = 'http://127.0.0.1:' + server.address().port + '/api';
    await run((path, options) => fetch(address + path, options));
  } finally {
    await new Promise(resolve => server.close(resolve));
    close();
  }
}

const importCsv = (body, token = 'test-token') => ({
  method: 'POST',
  headers: { 'Content-Type': 'text/csv', Authorization: 'Bearer ' + token },
  body,
});

test('health and order endpoints serve the seed data', async () => {
  await serve(':memory:', async request => {
    const health = await request('/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const response = await request('/orders');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const { orders } = await response.json();
    assert.equal(orders.length, 520);
    assert.ok(orders[0].date >= orders.at(-1).date);
  });
});

test('import rejects unauthorized and invalid CSV without partially saving orders', async () => {
  await serve(':memory:', async request => {
    const unauthorized = await request('/orders/import', importCsv(header + order, 'wrong'));
    assert.equal(unauthorized.status, 401);
    const invalidRow = 'INVALID,2026-02-30,CUST-NEW,Sports,South,1\n';
    const invalid = await request('/orders/import', importCsv(header + order + invalidRow));
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).message, /row 2/);
    const { orders } = await (await request('/orders')).json();
    assert.equal(orders.length, 520);
  });
});

test('import increments totals exactly once and survives reopening the database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'salespulse-'));
  const path = join(directory, 'orders.sqlite');
  let expectedRevenue;
  try {
    await serve(path, async request => {
      const baseline = (await (await request('/orders')).json()).orders;
      expectedRevenue = baseline.reduce((total, row) => total + Math.round(row.amount * 100), 125025);
      const imported = await request('/orders/import', importCsv(header + order + order));
      assert.equal(imported.status, 200);
      assert.deepEqual(await imported.json(), { imported: 1, skipped: 1 });
    });
    await serve(path, async request => {
      const { orders } = await (await request('/orders')).json();
      assert.equal(orders.length, 521);
      assert.equal(orders.find(row => row.id === 'CAPSTONE-001').category, 'Office, Home');
      assert.equal(orders.reduce((total, row) => total + Math.round(row.amount * 100), 0), expectedRevenue);
      const duplicate = await request('/orders/import', importCsv(header + order));
      assert.deepEqual(await duplicate.json(), { imported: 0, skipped: 1 });
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

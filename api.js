import { timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parse } from 'csv-parse/sync';
import express from 'express';

const columns = ['Order ID', 'Order Date', 'Customer ID', 'Product Category', 'Region', 'Sales Amount'];

class InvalidCsv extends Error {}

function parseOrders(csv) {
  let rows;
  try {
    rows = parse(csv, { bom: true, skip_empty_lines: true, trim: true });
  } catch {
    throw new InvalidCsv('Check the CSV formatting and make sure each row has six columns.');
  }
  const [header, ...orders] = rows;
  if (!header || header.some((field, index) => field !== columns[index]) ||
      header.length !== columns.length || !orders.length) {
    throw new InvalidCsv('Use the six column headers from Export report and include at least one order.');
  }
  return orders.map(([id, date, customer, category, region, amount], index) => {
    const calendarDate = new Date(date + 'T00:00:00Z');
    const cents = Math.round(Number(amount) * 100);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(calendarDate.getTime()) && calendarDate.toISOString().slice(0, 10) === date;
    const validText = [id, customer, category, region].every(
      (value) => value.length > 0 && value.length <= 120 && !/^[=+@-]/.test(value),
    );
    if (!validText || !validDate || !/^\d{1,10}(\.\d{1,2})?$/.test(amount)) {
      throw new InvalidCsv('Check order row ' + (index + 1) + ': use a valid date, filled text fields and a nonnegative amount with up to two decimals.');
    }
    return [id, date, customer, category, region, cents];
  });
}

export function createApi({ databasePath, importToken } = {}) {
  const path = databasePath ?? process.env.SALESPULSE_DB ?? '.salespulse/orders.sqlite';
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, customer TEXT NOT NULL,
      category TEXT NOT NULL, region TEXT NOT NULL, cents INTEGER NOT NULL
    );
  `);
  const insert = database.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING');
  function save(rows) {
    database.exec('BEGIN IMMEDIATE');
    try {
      const added = rows.reduce((total, row) => total + insert.run(...row).changes, 0);
      database.exec('COMMIT');
      return added;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  if (!database.prepare('SELECT 1 FROM orders LIMIT 1').get()) {
    const seed = readFileSync(new URL('../src/data/orders.csv', import.meta.url), 'utf8');
    save(parseOrders(seed));
  }

  const token = importToken ?? process.env.SALESPULSE_IMPORT_TOKEN;
  const api = express.Router();
  api.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  api.get('/health', (_request, response) => {
    database.prepare('SELECT 1').get();
    response.json({ status: 'ok' });
  });
  api.get('/orders', (_request, response) => {
    const orders = database.prepare(`
      SELECT id, date, customer, category, region, cents / 100.0 AS amount
      FROM orders ORDER BY date DESC, id ASC
    `).all();
    response.json({ orders, loadedAt: new Date().toISOString() });
  });
  api.post('/orders/import', (request, response, next) => {
    if (!token) return response.status(503).json({ message: 'CSV import is disabled on this server.' });
    const expected = Buffer.from('Bearer ' + token);
    const supplied = Buffer.from(request.get('authorization') ?? '');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return response.status(401).json({ message: 'Enter a valid import key and try again.' });
    }
    if (!request.is('text/csv')) {
      return response.status(415).json({ message: 'Upload a CSV file.' });
    }
    next();
  }, express.text({ type: 'text/csv', limit: '1mb' }), (request, response) => {
    const rows = parseOrders(request.body ?? '');
    const imported = save(rows);
    response.json({ imported, skipped: rows.length - imported });
  });
  api.use((_request, response) => response.status(404).json({ message: 'This API route does not exist.' }));
  api.use((error, _request, response, _next) => {
    if (error instanceof InvalidCsv) return response.status(400).json({ message: error.message });
    if (error.status === 413) return response.status(413).json({ message: 'Choose a CSV file smaller than 1 MB.' });
    console.error(error);
    return response.status(500).json({ message: 'Sales data is temporarily unavailable. Try again shortly.' });
  });
  return { api, close: () => database.close() };
}

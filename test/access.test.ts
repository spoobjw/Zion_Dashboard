import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAccess, checkRequestOrigin } from '../src/server/access.ts';
import { createZionServer } from '../src/server/index.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const basic = (value: string) => 'Basic ' + Buffer.from(value).toString('base64');
test('remote clients require credentials; local-only mode and credentials are enforced', () => {
  assert.equal(checkAccess('127.0.0.1', undefined, ''), true);
  assert.equal(checkAccess('::ffff:127.0.0.1', undefined, ''), true);
  for (const ip of ['192.168.1.2', '100.64.1.2', undefined]) {
    assert.equal(checkAccess(ip, undefined, ''), false);
    assert.equal(checkAccess(ip, basic('zion:incorrect'), 'test-password'), false);
    assert.equal(checkAccess(ip, basic('zion:test-password'), 'test-password'), true);
  }
  assert.equal(checkAccess('127.0.0.1', undefined, 'test-password'), false);
  assert.equal(checkAccess('100.64.1.2', basic('other:test-password'), 'test-password'), false);
});
test('browser origins must match the dashboard host', () => {
  assert.equal(checkRequestOrigin({ headers: { host: 'localhost:3400', origin: 'http://localhost:3400' } }), true);
  assert.equal(checkRequestOrigin({ headers: { host: 'localhost:3400', origin: 'https://example.com' } }), false);
  assert.equal(checkRequestOrigin({ headers: { host: 'localhost:3400', origin: 'null' } }), false);
});
test('server rejects cross-origin writes and non-JSON writes', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'zion-access-'));
  const { server, ctx } = createZionServer(folder, 0);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers: Record<string, string> = process.env.ZION_ACCESS_PASSWORD ? { Authorization: basic(`zion:${process.env.ZION_ACCESS_PASSWORD}`) } : {};
  try {
    const cross = await fetch(base + '/api/prayer/request', { method: 'POST', headers: { ...headers, Origin: 'http://example.com', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(cross.status, 403);
    const form = await fetch(base + '/api/prayer/request', { method: 'POST', headers, body: '{}' });
    assert.equal(form.status, 415);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve())); ctx.db.close(); fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('configured password protects HTTP endpoints and accepts valid credentials', async () => {
  const previousPassword = process.env.ZION_ACCESS_PASSWORD;
  process.env.ZION_ACCESS_PASSWORD = 'synthetic-regression-password';
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'zion-auth-'));
  const { server, ctx } = createZionServer(folder, 0);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const anonymous = await fetch(base + '/api/health');
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get('www-authenticate') || '', /Basic/);
    assert.equal(anonymous.headers.get('cache-control'), 'no-store');
    const authenticated = await fetch(base + '/api/health', { headers: { Authorization: basic('zion:synthetic-regression-password') } });
    assert.equal(authenticated.status, 200);
    const wrong = await fetch(base + '/api/health', { headers: { Authorization: basic('zion:incorrect') } });
    assert.equal(wrong.status, 401);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve())); ctx.db.close(); fs.rmSync(folder, { recursive: true, force: true });
    if (previousPassword === undefined) delete process.env.ZION_ACCESS_PASSWORD;
    else process.env.ZION_ACCESS_PASSWORD = previousPassword;
  }
});

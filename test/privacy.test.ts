import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('service worker removes old Zion caches and never intercepts records', async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const deleted: string[] = [];
  const context = {
    self: { location: { origin: 'https://zion.test' }, addEventListener: (name: string, fn: any) => { handlers[name] = fn; }, clients: { claim: async () => {} } },
    caches: { keys: async () => ['zion-hub-v1', 'zion-shell-v2', 'another-app'], delete: async (key: string) => { deleted.push(key); } }, URL,
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), context);
  let completion: Promise<unknown> = Promise.resolve();
  handlers.activate({ waitUntil: (promise: Promise<unknown>) => { completion = promise; } });
  await completion;
  assert.deepEqual(deleted, ['zion-hub-v1']);
  for (const pathname of ['/api/membership/overview', '/api/prayer/overview', '/api/sermon/overview', '/api/finances/overview', '/uploads/statement.pdf']) {
    let intercepted = false;
    handlers.fetch({ request: { method: 'GET', url: 'https://zion.test' + pathname }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, pathname);
  }
});

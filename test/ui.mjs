import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright-core';

// Synthetic responses only: no local database or external ministry files are opened.
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(process.cwd(), 'dist/client', pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.ZION_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
let saves = [], failMember = false;
let record = { id: '', series_folder: 'Eden_People', sermon_code: 'TEST', sermon_title: 'Synthetic sermon', scripture_ref: 'Matthew 5', structure_chosen: 'Stanley ME-WE-GOD-YOU-WE', structure_rationale: '', bottom_line: 'A light for our neighbors.', sticky_image: 'A porch light.', porch_word_count: 200, total_word_count: 2000, resistance_notes: '', gospel_turn_check: '', cut_candidates_json: '[]', preachable_verified_json: '{}', wizard_step: 3 };
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (url.pathname === '/api/sermon/overview') return json({ refinements: [record], manuscriptFiles: [] });
  if (url.pathname === '/api/sermon/evaluate-preach') return json({ wordCount: 6, readingGrade: 5, passesGradeTarget: true, oneSentenceCheck: true, preachChecklist: {} });
  if (url.pathname === '/api/sermon/refinement') {
    const data = route.request().postDataJSON(); saves.push(data); record = { ...data, id: 'saved-record' }; return json({ ok: true, id: record.id });
  }
  if (url.pathname === '/api/membership/member' && failMember) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic save failure' }) });
  return json({ members: [], households: [], careLogs: [], documents: [], requests: [], projects: [], motions: [], notes: [], provenResources: [], stewardBlocks: [], posts: [], testBoardPosts: [] });
});
const base = `http://127.0.0.1:${server.address().port}`;
try {
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#refinement-step')?.value === '3');
  assert.equal(await page.locator('#refinement-step').inputValue(), '3');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Save refinement', exact: true }).click();
  await page.getByText('Refinement saved.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save refinement', exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(saves[0]?.id, '');
  assert.equal(saves[1]?.id, 'saved-record');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#refinement-step')?.value === '4');
  await page.getByText('Sermon details & preparation tools', { exact: true }).click();
  await page.getByText('Working Title', { exact: true }).locator('..').locator('input').fill('Unsaved synthetic title');
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add Person', exact: true }).click();
  await page.getByPlaceholder('First Name *', { exact: true }).fill('Example');
  await page.getByPlaceholder('Last Name *', { exact: true }).fill('Fixture');
  failMember = true;
  await page.locator('form button[type="submit"]').click();
  await page.getByRole('alert').filter({ hasText: 'Synthetic save failure' }).waitFor();
  assert.equal(await page.getByPlaceholder('First Name *', { exact: true }).inputValue(), 'Example');
  await page.route('**/api/membership/member', route => route.abort('failed'));
  await page.locator('form button[type="submit"]').click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByPlaceholder('First Name *', { exact: true }).inputValue(), 'Example');
  await page.unroute('**/api/membership/member');
  await page.getByRole('button', { name: 'Sermon', exact: true }).click();
  assert.equal(await page.getByText('Working Title', { exact: true }).locator('..').locator('input').inputValue(), 'Unsaved synthetic title');
  await page.getByRole('button', { name: 'Help & settings', exact: true }).click();
  await page.getByRole('button', { name: 'Help & settings', exact: true }).click();
  assert.equal(await page.getByText('Working Title', { exact: true }).locator('..').locator('input').inputValue(), 'Unsaved synthetic title');
  await page.getByText('Sermon details & preparation tools', { exact: true }).click();
  await page.locator('#refinement-step').selectOption('1');
  await page.waitForTimeout(400);
  const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'zion-ui-'));
  await page.screenshot({ path: path.join(screenshots, 'desktop.png'), fullPage: true });
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 850 });
    for (const name of ['Sermon', 'Study', 'Prayer', 'People', 'Finance', 'Board', 'Steward']) {
      if (['People', 'Finance', 'Board', 'Steward'].includes(name)) await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, `${name} overflows at ${width}px`);
    }
  }
  await page.getByRole('button', { name: 'Sermon', exact: true }).click();
  await page.screenshot({ path: path.join(screenshots, 'mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: saved identity/step, failed-save retention, draft navigation, all 7 modules at 320px/375px.');
  console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

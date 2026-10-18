import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import { createZionServer } from '../src/server/index.ts';
import { extractStewardBlocksFromMarkdown } from '../src/server/routes/steward.ts';

test('Zion Dashboard end-to-end API suite across all 7 modules', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zion-dashboard-test-'));
  const { server, ctx } = createZionServer(tempDir, 0);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Health & Network
    const healthRes = await fetch(`${base}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');

    // 2. Module 1: Membership & Care Sync to Prayer
    const memOverview = await (await fetch(`${base}/api/membership/overview`)).json();
    assert.ok(memOverview.members.length >= 4);

    const addMemRes = await fetch(`${base}/api/membership/member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Ruth',
        last_name: 'Bauer',
        status: 'Member',
        phone: '970-522-9900',
        care_flag: 1,
        care_notes: 'Recovering at home; needs meal train.',
        sync_to_prayer: true,
      }),
    });
    assert.equal(addMemRes.status, 200);

    // 3. Module 2: Church Finances Scanned PDF Upload & Math Discrepancy Check
    const uploadRes = await fetch(`${base}/api/finances/upload-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: '2026-10_Zion_Monthly_Scan.pdf',
        base64Pdf: Buffer.from('%PDF-1.4 mock scan').toString('base64'),
        period_type: 'monthly',
        statement_date: '2026-10',
        ocr_engine: 'local-template',
      }),
    });
    assert.equal(uploadRes.status, 200);
    const uploadJson = await uploadRes.json();
    assert.ok(uploadJson.id);

    // 4. Module 3: Board Administration & Packet Generator
    const packetRes = await fetch(`${base}/api/board/generate-packet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_date: '2026-11-10', pastor_report: 'E20 Preachable ready.' }),
    });
    assert.equal(packetRes.status, 200);
    const packetJson = await packetRes.json();
    assert.match(packetJson.packetMarkdown, /Treasurer & Financial Report/);

    // 5. Module 4: Sermon Prep & P-R-E-A-C-H Evaluator + Preachable .docx Verifier
    const preachRes = await fetch(`${base}/api/sermon/evaluate-preach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bottom_line: 'Jesus does not tell you to try harder to be salt and light, but shows who you already are on his mountain.',
        sticky_image: 'A porch light on in a Sterling blizzard.',
        porch_text: 'Word '.repeat(210),
      }),
    });
    assert.equal(preachRes.status, 200);
    const preachJson = await preachRes.json();
    assert.equal(preachJson.preachChecklist.picture, true);
    assert.equal(preachJson.preachChecklist.contrast, true);
    assert.equal(preachJson.porchAudit.fits90SecPorch, true);

    // 6. Module 5: Logos Workbench Overview & Note Creation
    const logosNoteRes = await fetch(`${base}/api/logos/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: 'Matthew 5:17-20',
        title: 'Telos of the Law',
        commentator: 'RT France',
        logos_id: 'LLS:NICNT40MT',
        deep_link: 'https://app.logos.com/books/LLS:NICNT40MT/offsets/12345?query=stripme',
        summary_markdown: 'Fulfill means eschatological completion.',
      }),
    });
    assert.equal(logosNoteRes.status, 200);
    const logosOverview = await (await fetch(`${base}/api/logos/overview?reference=Matthew+5:17-20`)).json();
    const savedNote = logosOverview.notes.find((n: { title: string }) => n.title === 'Telos of the Law');
    assert.equal(savedNote.deep_link, 'https://app.logos.com/books/LLS:NICNT40MT/offsets/12345');

    // 7. Module 6: Steward Campaign Block Parser
    const sampleMd = '### E20 Teaser\n```steward\n{"v":1,"episode":"E20","title":"FULFILLED","postDate":"2026-10-22","status":"recommended","updated":"2026-10-18","facebook":"Hello Sterling"}\n```';
    const blocks = extractStewardBlocksFromMarkdown(sampleMd);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].episode, 'E20');

    // 8. Module 7: Prayer App Deck & Pray-Now Counter
    const prayerOverview = await (await fetch(`${base}/api/prayer/overview`)).json();
    assert.ok(prayerOverview.requests.some((r: { person_name: string }) => r.person_name === 'Ruth Bauer'));
    const targetPrayer = prayerOverview.requests[0];
    const prayNowRes = await fetch(`${base}/api/prayer/pray-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: targetPrayer.id, journal_note: 'Prayed during morning watch.' }),
    });
    assert.equal(prayNowRes.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    ctx.db.close();
  }
});

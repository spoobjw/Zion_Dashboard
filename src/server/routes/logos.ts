import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium, BrowserContext, Page } from 'playwright-core';
import { DBContext } from '../db.ts';
import { readJsonBody, sendError, sendJson } from '../http-utils.ts';

let logosContext: BrowserContext | null = null;
let logosPage: Page | null = null;
let limitedViewActive = false;

export const PROVEN_LOGOS_RESOURCES = [
  { name: 'UBS Handbook', logosId: 'LLS:34.0.153', role: 'Grammar, translation options, waw ambiguity, accentuation' },
  { name: 'New American Commentary (NAC)', logosId: 'LLS:NAC02', role: 'Detail, excursuses, sermon-usable OT/NT background' },
  { name: 'Preaching the Word (Ryken)', logosId: 'LLS:PRWDEX', role: 'Homiletics & pre-fitted illustrations' },
  { name: 'Interpretation (Fretheim)', logosId: 'LLS:29.7.5', role: 'Theological freshness & canonical horizon' },
  { name: 'New Interpreter\'s Bible (Brueggemann)', logosId: 'LLS:NIBAB', role: 'Theological commentary & pastoral reflection' },
  { name: 'For Everyone (Goldingay / Wright)', logosId: 'LLS:EVRY02EX', role: 'Plain-language framing that preaches straight' },
  { name: '1001 Illustrations that Connect', logosId: 'LLS:1001ILLCONCT', role: 'Topic-tagged illustrations (use /offsets/20000)' },
];

export function buildLogosUrls(reference: string) {
  const encoded = encodeURIComponent(reference.trim()).replace(/%20/g, '+');
  return {
    passageGuide: `https://app.logos.com/guides/passage?reference=${encoded}`,
    exegeticalGuide: `https://app.logos.com/guides/exegetical?reference=${encoded}`,
    sermonStarterGuide: `https://app.logos.com/guides/sermon-starter?reference=${encoded}`,
    bibleSearch: `https://app.logos.com/search?q=${encoded}&case=ignore&form=all&ref=default&resources=topBible&kind=bible&view=passages&syntax=v2&engine=semantic&source=SearchPanel`,
  };
}

async function ensureLogosBrowser(dataDir: string): Promise<Page> {
  if (logosPage && !logosPage.isClosed()) {
    return logosPage;
  }
  const userDataDir = path.join(dataDir, 'logos-browser-profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  const channels: Array<'chrome' | 'msedge'> = ['chrome', 'msedge'];
  let lastErr: unknown;
  for (const channel of channels) {
    try {
      logosContext = await chromium.launchPersistentContext(userDataDir, {
        channel,
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: ['--disable-blink-features=AutomationControlled'],
      });
      logosPage = logosContext.pages()[0] || (await logosContext.newPage());
      return logosPage;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Could not launch built-in Chromium/Edge browser for Logos: ${String(lastErr)}`);
}

export async function handleLogosRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  ctx: DBContext
): Promise<boolean> {
  const { db, dataDir } = ctx;

  if (req.method === 'GET' && url.pathname === '/api/logos/overview') {
    const notes = db.prepare('SELECT * FROM logos_study_notes ORDER BY created_at DESC').all();
    const ref = url.searchParams.get('reference') || 'Matthew 5:17-20';
    sendJson(res, {
      notes,
      provenResources: PROVEN_LOGOS_RESOURCES,
      guideUrls: buildLogosUrls(ref),
      browserStatus: {
        isOpen: Boolean(logosPage && !logosPage.isClosed()),
        currentUrl: logosPage && !logosPage.isClosed() ? logosPage.url().split('?')[0] : '',
        limitedViewActive,
      },
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/logos/note') {
    const body = await readJsonBody<{
      id?: string;
      reference: string;
      guide_type?: string;
      title: string;
      commentator?: string;
      logos_id?: string;
      deep_link?: string;
      summary_markdown: string;
      crux_tag?: string;
      series_code?: string;
    }>(req);

    if (!body.reference?.trim() || !body.summary_markdown?.trim()) {
      sendError(res, 'Reference and summary are required.');
      return true;
    }

    const id = body.id || randomUUID();
    const now = new Date().toISOString();
    // Strip query string if deep_link is an offsets URL per LOGOS.md ground rule
    const cleanLink = (body.deep_link || '').includes('/books/')
      ? (body.deep_link || '').split('?')[0]
      : body.deep_link || '';

    db.prepare(`
      INSERT INTO logos_study_notes (
        id, reference, guide_type, title, commentator, logos_id, deep_link, summary_markdown, crux_tag, series_code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        reference = excluded.reference,
        guide_type = excluded.guide_type,
        title = excluded.title,
        commentator = excluded.commentator,
        logos_id = excluded.logos_id,
        deep_link = excluded.deep_link,
        summary_markdown = excluded.summary_markdown,
        crux_tag = excluded.crux_tag,
        series_code = excluded.series_code
    `).run(
      id,
      body.reference.trim(),
      body.guide_type || 'Passage Guide',
      body.title?.trim() || `${body.reference} Note`,
      body.commentator || '',
      body.logos_id || '',
      cleanLink,
      body.summary_markdown.trim(),
      body.crux_tag || '',
      body.series_code || 'Eden_People',
      now
    );

    sendJson(res, { ok: true, id });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/logos/browser/launch') {
    const body = await readJsonBody<{ reference?: string; guide?: 'passage' | 'exegetical' | 'sermon-starter'; directUrl?: string }>(req);
    try {
      const page = await ensureLogosBrowser(dataDir);
      const urls = buildLogosUrls(body.reference || 'Matthew 5:17-20');
      let targetUrl = body.directUrl || urls.passageGuide;
      if (!body.directUrl) {
        switch (body.guide || 'passage') {
          case 'passage':
            targetUrl = urls.passageGuide;
            break;
          case 'exegetical':
            targetUrl = urls.exegeticalGuide;
            break;
          case 'sermon-starter':
            targetUrl = urls.sermonStarterGuide;
            break;
          default: {
            const _exhaustive: never = body.guide as never;
            targetUrl = String(_exhaustive || urls.passageGuide);
          }
        }
      }

      // Per LOGOS.md: navigate timeout is NOT a failed navigation because Logos keeps long-polling open
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(2500);

      const screenshotBuf = await page.screenshot({ type: 'jpeg', quality: 75 }).catch(() => null);
      const extracted = await page
        .evaluate(() => {
          const articles = Array.from(document.querySelectorAll('article')).map(
            (a, i) => `${i}: [${a.getAttribute('aria-label') || ''}] ${(a as HTMLElement).innerText.slice(0, 280).replace(/\n/g, ' ')}`
          );
          const commentaryLinks = Array.from(document.querySelectorAll('a'))
            .filter((a) => (a.getAttribute('href') || '').includes('/books/'))
            .slice(0, 25)
            .map((a) => ({
              label: (a.textContent || '').trim(),
              href: (a.getAttribute('href') || '').split('?')[0],
            }));
          return {
            title: document.title,
            articlesCount: articles.length,
            articlesPreview: articles.slice(0, 8),
            commentaryLinks,
            bodySnippet: (document.body?.innerText || '').slice(0, 2000),
          };
        })
        .catch(() => ({
          title: 'Logos Web App',
          articlesCount: 0,
          articlesPreview: [],
          commentaryLinks: [],
          bodySnippet: '',
        }));

      sendJson(res, {
        ok: true,
        targetUrl: targetUrl.split('?')[0],
        limitedViewActive,
        extracted,
        screenshotBase64: screenshotBuf ? `data:image/jpeg;base64,${screenshotBuf.toString('base64')}` : null,
      });
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : String(err), 500);
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/logos/browser/restore-full-view') {
    if (!logosPage || logosPage.isClosed()) {
      limitedViewActive = false;
      sendJson(res, { ok: true, fullViewRestored: true, note: 'Browser closed; Limited View is not active.' });
      return true;
    }
    try {
      const result = await logosPage.evaluate(() => {
        const bannerLink = Array.from(document.querySelectorAll('a, button')).find((el) =>
          /Turn on Full View mode/i.test(el.textContent || '')
        ) as HTMLElement | undefined;
        if (bannerLink) bannerLink.click();

        const buttons = Array.from(document.querySelectorAll('button')).filter((x) =>
          ['Yes', 'No'].includes((x.textContent || '').trim())
        );
        if (buttons.length >= 8) {
          buttons[7].click();
          return {
            yes: /active_/.test(buttons[6].className),
            no: /active_/.test(buttons[7].className),
          };
        }
        return { yes: false, no: true };
      });
      limitedViewActive = Boolean(result.yes);
      sendJson(res, { ok: true, fullViewRestored: result.no, verification: result });
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : String(err), 500);
    }
    return true;
  }

  return false;
}

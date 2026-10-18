import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DBContext } from '../db.ts';
import { readJsonBody, sendError, sendJson } from '../http-utils.ts';

const STEWARD_ROOT = 'C:\\Codex_Projects\\Social_Media_Bot';
const STEWARD_STATE_FILE = path.join(STEWARD_ROOT, 'data', 'state.json');
const EDEN_CAMPAIGN_FILE = 'C:\\Claude_Cowork_Projects\\Zion_CoWork\\Eden_People\\Eden_People_Social_Media_Campaign.md';

export interface StewardCampaignBlock {
  v: 1;
  episode: string;
  title: string;
  postDate: string;
  sundayDate?: string;
  role?: 'teaser' | 'recap' | 'reminder' | 'invite';
  status: 'recommended' | 'alternate' | 'superseded';
  updated: string;
  facebook: string;
  instagram?: string;
  altText?: string;
  image?: { idea?: string; hint?: string };
  engagementComment?: string;
  doNotPost?: string[];
}

export function extractStewardBlocksFromMarkdown(markdown: string): StewardCampaignBlock[] {
  const blocks: StewardCampaignBlock[] = [];
  const regex = /```steward\s*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as StewardCampaignBlock;
      if (parsed && parsed.v === 1 && parsed.episode) {
        blocks.push(parsed);
      }
    } catch {
      // Skip malformed block
    }
  }
  return blocks;
}

export async function handleStewardRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  _ctx: DBContext
): Promise<boolean> {
  if (req.method === 'GET' && url.pathname === '/api/steward/overview') {
    const stateExists = fs.existsSync(STEWARD_STATE_FILE);
    const stateData = stateExists
      ? (JSON.parse(fs.readFileSync(STEWARD_STATE_FILE, 'utf8')) as Record<string, unknown>)
      : { clients: [], campaigns: [], posts: [], testBoard: { posts: [] } };

    const campaignMdExists = fs.existsSync(EDEN_CAMPAIGN_FILE);
    const campaignMd = campaignMdExists ? fs.readFileSync(EDEN_CAMPAIGN_FILE, 'utf8') : '';
    const stewardBlocks = extractStewardBlocksFromMarkdown(campaignMd);

    // Check if live Steward daemon is listening on 127.0.0.1:3000 (or STEWARD_PORT)
    const stewardPort = Number(process.env.STEWARD_PORT || 3000);
    let daemonOnline = false;
    let liveState: Record<string, unknown> | null = null;
    try {
      const resp = await fetch(`http://127.0.0.1:${stewardPort}/api/state`, {
        headers: { Host: `127.0.0.1:${stewardPort}` },
        signal: AbortSignal.timeout(1200),
      });
      if (resp.ok) {
        daemonOnline = true;
        liveState = (await resp.json()) as Record<string, unknown>;
      }
    } catch {
      daemonOnline = false;
    }

    const effectiveState = liveState || stateData;
    const posts = Array.isArray(effectiveState.posts) ? effectiveState.posts : [];
    const campaigns = Array.isArray(effectiveState.campaigns) ? effectiveState.campaigns : [];
    const testBoardPosts =
      (effectiveState.testBoard as { posts?: unknown[] } | undefined)?.posts || [];

    sendJson(res, {
      stewardRoot: STEWARD_ROOT,
      daemonOnline,
      stewardPort,
      campaignFile: EDEN_CAMPAIGN_FILE,
      stewardBlocks,
      campaigns: campaigns.slice(0, 20),
      posts: posts.slice(0, 30),
      testBoardPosts: testBoardPosts.slice(0, 15),
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/steward/save-block') {
    const body = await readJsonBody<StewardCampaignBlock>(req);
    if (!body.episode?.trim() || !body.title?.trim() || !body.facebook?.trim()) {
      sendError(res, 'Episode, title, and Facebook caption are required for a Steward block.');
      return true;
    }

    const newBlock: StewardCampaignBlock = {
      v: 1,
      episode: body.episode.trim(),
      title: body.title.trim(),
      postDate: body.postDate || new Date().toISOString().slice(0, 10),
      sundayDate: body.sundayDate || '',
      role: body.role || 'teaser',
      status: body.status || 'recommended',
      updated: new Date().toISOString().slice(0, 10),
      facebook: body.facebook,
      instagram: body.instagram || body.facebook.slice(0, 2200),
      altText: body.altText || '',
      image: body.image || { idea: '', hint: '' },
      engagementComment: body.engagementComment || '',
      doNotPost: Array.isArray(body.doNotPost) ? body.doNotPost : [],
    };

    if (!fs.existsSync(EDEN_CAMPAIGN_FILE)) {
      sendError(res, `Campaign markdown file not found at ${EDEN_CAMPAIGN_FILE}`, 404);
      return true;
    }

    let md = fs.readFileSync(EDEN_CAMPAIGN_FILE, 'utf8');
    // Mark any prior recommended block for the same episode + role as superseded per CAMPAIGN-BLOCK.md
    md = md.replace(/```steward\s*\r?\n([\s\S]*?)```/g, (full, inner: string) => {
      try {
        const parsed = JSON.parse(inner.trim()) as StewardCampaignBlock;
        if (
          parsed.episode === newBlock.episode &&
          (parsed.role || 'teaser') === (newBlock.role || 'teaser') &&
          parsed.status === 'recommended'
        ) {
          parsed.status = 'superseded';
          return '```steward\n' + JSON.stringify(parsed, null, 2) + '\n```';
        }
      } catch {
        // leave untouched
      }
      return full;
    });

    const formattedBlock = `\n\n\`\`\`steward\n${JSON.stringify(newBlock, null, 2)}\n\`\`\`\n`;
    md = md.trimEnd() + formattedBlock;
    fs.writeFileSync(EDEN_CAMPAIGN_FILE, md, 'utf8');

    sendJson(res, { ok: true, block: newBlock, blocks: extractStewardBlocksFromMarkdown(md) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/steward/proxy') {
    const body = await readJsonBody<{ endpoint: string; payload?: Record<string, unknown> }>(req);
    const stewardPort = Number(process.env.STEWARD_PORT || 3000);
    const baseOrigin = `http://127.0.0.1:${stewardPort}`;

    try {
      const stateResp = await fetch(`${baseOrigin}/api/state`, {
        headers: { Host: `127.0.0.1:${stewardPort}` },
        signal: AbortSignal.timeout(2500),
      });
      if (!stateResp.ok) {
        sendError(res, `Steward daemon returned HTTP ${stateResp.status}`, 502);
        return true;
      }
      const stateJson = (await stateResp.json()) as { csrf?: string };
      const csrf = stateJson.csrf || '';

      const actionResp = await fetch(`${baseOrigin}${body.endpoint}`, {
        method: 'POST',
        headers: {
          Host: `127.0.0.1:${stewardPort}`,
          Origin: baseOrigin,
          'Content-Type': 'application/json',
          'x-csrf-token': csrf,
        },
        body: JSON.stringify(body.payload || {}),
      });
      const result = await actionResp.json();
      sendJson(res, { ok: actionResp.ok, result }, actionResp.status);
    } catch (err) {
      sendError(
        res,
        `Steward daemon is not currently running on port ${stewardPort}. Campaign blocks are still saved directly to Eden_People_Social_Media_Campaign.md. (${String(err)})`,
        503
      );
    }
    return true;
  }

  return false;
}

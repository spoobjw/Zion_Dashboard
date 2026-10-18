import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { DBContext } from '../db.ts';
import { readJsonBody, sendError, sendJson } from '../http-utils.ts';

export async function handlePrayerRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  ctx: DBContext
): Promise<boolean> {
  const { db } = ctx;

  if (req.method === 'GET' && url.pathname === '/api/prayer/overview') {
    const requests = db
      .prepare(`
        SELECT * FROM prayer_requests
        ORDER BY
          CASE status WHEN 'Active' THEN 0 WHEN 'Answered' THEN 1 ELSE 2 END,
          CASE urgency WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Regular' THEN 2 ELSE 3 END,
          CASE WHEN last_prayed_at = '' THEN '0000' ELSE last_prayed_at END ASC
      `)
      .all();

    const recentLogs = db
      .prepare(`
        SELECT l.*, r.person_name, r.title, r.circle
        FROM prayer_logs l
        JOIN prayer_requests r ON l.request_id = r.id
        ORDER BY l.prayed_at DESC
        LIMIT 30
      `)
      .all();

    sendJson(res, { requests, recentLogs });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/prayer/request') {
    const body = await readJsonBody<{
      id?: string;
      circle: string;
      person_name: string;
      linked_member_id?: string | null;
      privacy_mode?: 'full' | 'initials';
      subgroup?: string;
      title: string;
      details?: string;
      scripture_anchor?: string;
      urgency?: 'Urgent' | 'High' | 'Regular' | 'Praise';
      status?: 'Active' | 'Answered' | 'Archived';
      answer_testimony?: string;
    }>(req);

    if (!body.person_name?.trim() || !body.title?.trim()) {
      sendError(res, 'Person name and prayer title are required.');
      return true;
    }

    const id = body.id || randomUUID();
    const now = new Date().toISOString();
    const answeredAt = body.status === 'Answered' ? now : '';

    db.prepare(`
      INSERT INTO prayer_requests (
        id, circle, person_name, linked_member_id, privacy_mode, subgroup,
        title, details, scripture_anchor, urgency, status, answered_at, answer_testimony, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        circle = excluded.circle,
        person_name = excluded.person_name,
        linked_member_id = excluded.linked_member_id,
        privacy_mode = excluded.privacy_mode,
        subgroup = excluded.subgroup,
        title = excluded.title,
        details = excluded.details,
        scripture_anchor = excluded.scripture_anchor,
        urgency = excluded.urgency,
        status = excluded.status,
        answered_at = CASE WHEN excluded.status = 'Answered' AND prayer_requests.answered_at = '' THEN excluded.answered_at ELSE prayer_requests.answered_at END,
        answer_testimony = excluded.answer_testimony
    `).run(
      id,
      body.circle || 'Congregation',
      body.person_name.trim(),
      body.linked_member_id || null,
      body.privacy_mode || 'full',
      body.subgroup || '',
      body.title.trim(),
      body.details || '',
      body.scripture_anchor || '',
      body.urgency || 'Regular',
      body.status || 'Active',
      answeredAt,
      body.answer_testimony || '',
      now
    );

    sendJson(res, { ok: true, id });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/prayer/pray-now') {
    const body = await readJsonBody<{ id: string; journal_note?: string }>(req);
    if (!body.id) {
      sendError(res, 'Prayer request id required.');
      return true;
    }
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE prayer_requests
      SET prayer_count = prayer_count + 1, last_prayed_at = ?
      WHERE id = ?
    `).run(now, body.id);

    db.prepare(`
      INSERT INTO prayer_logs (id, request_id, journal_note, prayed_at)
      VALUES (?, ?, ?, ?)
    `).run(randomUUID(), body.id, body.journal_note?.trim() || '', now);

    sendJson(res, { ok: true, prayedAt: now });
    return true;
  }

  return false;
}

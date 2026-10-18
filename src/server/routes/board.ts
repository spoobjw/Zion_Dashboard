import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { DBContext } from '../db.ts';
import { readJsonBody, sendError, sendJson } from '../http-utils.ts';

export async function handleBoardRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  ctx: DBContext
): Promise<boolean> {
  const { db } = ctx;

  if (req.method === 'GET' && url.pathname === '/api/board/overview') {
    const projects = db.prepare('SELECT * FROM board_projects ORDER BY CASE priority WHEN \'High\' THEN 1 WHEN \'Normal\' THEN 2 ELSE 3 END, target_date ASC').all();
    const meetings = db.prepare('SELECT * FROM board_meetings ORDER BY meeting_date DESC').all();
    const motions = db.prepare(`
      SELECT m.*, p.title as project_title, mtg.meeting_date
      FROM board_motions m
      LEFT JOIN board_projects p ON m.project_id = p.id
      LEFT JOIN board_meetings mtg ON m.meeting_id = mtg.id
      ORDER BY m.created_at DESC
    `).all();
    sendJson(res, { projects, meetings, motions });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/board/project') {
    const body = await readJsonBody<{
      id?: string;
      title: string;
      category?: string;
      status?: string;
      priority?: string;
      owner?: string;
      budget_allocated?: number;
      budget_spent?: number;
      target_date?: string;
      description?: string;
      next_milestone?: string;
    }>(req);

    if (!body.title?.trim()) {
      sendError(res, 'Project title is required.');
      return true;
    }

    const id = body.id || randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO board_projects (
        id, title, category, status, priority, owner,
        budget_allocated, budget_spent, target_date, description, next_milestone, updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        status = excluded.status,
        priority = excluded.priority,
        owner = excluded.owner,
        budget_allocated = excluded.budget_allocated,
        budget_spent = excluded.budget_spent,
        target_date = excluded.target_date,
        description = excluded.description,
        next_milestone = excluded.next_milestone,
        updated_at = excluded.updated_at
    `).run(
      id,
      body.title.trim(),
      body.category || 'Facilities',
      body.status || 'Proposed',
      body.priority || 'Normal',
      body.owner || '',
      Number(body.budget_allocated || 0),
      Number(body.budget_spent || 0),
      body.target_date || '',
      body.description || '',
      body.next_milestone || '',
      now,
      now
    );

    sendJson(res, { ok: true, id });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/board/motion') {
    const body = await readJsonBody<{
      meeting_id?: string | null;
      project_id?: string | null;
      motion_number: string;
      motion_text: string;
      moved_by?: string;
      seconded_by?: string;
      vote_result?: string;
      action_required?: string;
    }>(req);

    if (!body.motion_text?.trim()) {
      sendError(res, 'Motion text is required.');
      return true;
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO board_motions (
        id, meeting_id, project_id, motion_number, motion_text, moved_by, seconded_by, vote_result, action_required, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.meeting_id || null,
      body.project_id || null,
      body.motion_number || `M-${new Date().toISOString().slice(0, 7)}`,
      body.motion_text.trim(),
      body.moved_by || '',
      body.seconded_by || '',
      body.vote_result || 'Passed Unanimously',
      body.action_required || '',
      now
    );
    sendJson(res, { ok: true, id });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/board/generate-packet') {
    const body = await readJsonBody<{ meeting_date?: string; title?: string; pastor_report?: string }>(req);
    const meetingDate = body.meeting_date || new Date().toISOString().slice(0, 10);
    const title = body.title || `Zion Congregational Church Board Packet (${meetingDate})`;

    const activeProjects = db.prepare(`
      SELECT * FROM board_projects WHERE status != 'Completed' ORDER BY priority ASC, target_date ASC
    `).all() as Array<Record<string, unknown>>;

    const latestFinance = db.prepare(`
      SELECT * FROM finance_documents WHERE status = 'verified' ORDER BY statement_date DESC LIMIT 1
    `).get() as Record<string, unknown> | undefined;

    const recentMotions = db.prepare(`
      SELECT * FROM board_motions ORDER BY created_at DESC LIMIT 5
    `).all() as Array<Record<string, unknown>>;

    const financeSummary = latestFinance
      ? `Period ${latestFinance.statement_date} (${latestFinance.period_type}): Income $${Number(latestFinance.total_income).toLocaleString()} | Expenses $${Number(latestFinance.total_expenses).toLocaleString()} | Net $${Number(latestFinance.net_balance).toLocaleString()} | General Fund $${Number(latestFinance.general_fund_balance).toLocaleString()}`
      : 'No verified financial statement on file.';

    const packetMarkdown = [
      `# ${title}`,
      `**Date:** ${meetingDate} | **Location:** Zion Congregational Church, Sterling, CO`,
      ``,
      `## 1. Call to Order & Opening Prayer`,
      `- Scripture & Devotional Anchor`,
      `- Approval of Prior Minutes`,
      ``,
      `## 2. Treasurer & Financial Report`,
      `- **Latest Verified Statement:** ${financeSummary}`,
      latestFinance?.notes ? `- **Treasurer Notes:** ${latestFinance.notes}` : '',
      ``,
      `## 3. Pastor's Report`,
      body.pastor_report?.trim() || `- Preaching Series: *Eden People* (Sermon on the Mount Phase 3)\n- Pastoral visitation & care updates\n- Student & NJC outreach`,
      ``,
      `## 4. Active Board Projects (${activeProjects.length})`,
      ...activeProjects.map(
        (p) =>
          `- **[${p.status}] ${p.title}** (${p.category}) — Owner: ${p.owner || 'TBD'} | Budget: $${Number(p.budget_spent).toLocaleString()} / $${Number(p.budget_allocated).toLocaleString()} | Next: ${p.next_milestone || 'N/A'}`
      ),
      ``,
      `## 5. Recent Motions & Action Register`,
      ...recentMotions.map(
        (m) => `- **${m.motion_number}** (${m.vote_result}): ${m.motion_text} *(Moved: ${m.moved_by || '-'}, Seconded: ${m.seconded_by || '-'})*`
      ),
      ``,
      `## 6. Executive Session & Closing Prayer`,
    ]
      .filter(Boolean)
      .join('\n');

    const id = randomUUID();
    db.prepare(`
      INSERT INTO board_meetings (id, meeting_date, title, pastor_report, financial_summary, minutes_markdown, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Scheduled', ?)
    `).run(id, meetingDate, title, body.pastor_report || '', financeSummary, packetMarkdown, new Date().toISOString());

    sendJson(res, { ok: true, id, packetMarkdown });
    return true;
  }

  return false;
}

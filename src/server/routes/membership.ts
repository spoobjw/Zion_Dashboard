import http from 'node:http';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { DBContext } from '../db.ts';
import { readJsonBody, sendError, sendJson } from '../http-utils.ts';

export async function handleMembershipRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  ctx: DBContext
): Promise<boolean> {
  const { db } = ctx;

  if (req.method === 'GET' && url.pathname === '/api/membership/overview') {
    const households = db.prepare('SELECT * FROM households ORDER BY name ASC').all();
    const members = db.prepare(`
      SELECT m.*, h.name as household_name, h.address as household_address
      FROM members m
      LEFT JOIN households h ON m.household_id = h.id
      ORDER BY m.last_name ASC, m.first_name ASC
    `).all();
    const careLogs = db.prepare(`
      SELECT c.*, m.first_name, m.last_name
      FROM care_logs c
      JOIN members m ON c.member_id = m.id
      ORDER BY c.created_at DESC
      LIMIT 50
    `).all();
    sendJson(res, { households, members, careLogs });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/membership/household') {
    const body = await readJsonBody<{
      id?: string;
      name: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      phone?: string;
      anniversary?: string;
      notes?: string;
    }>(req);
    if (!body.name?.trim()) {
      sendError(res, 'Household name is required.');
      return true;
    }
    const id = body.id || randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO households (id, name, address, city, state, zip, phone, anniversary, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        address = excluded.address,
        city = excluded.city,
        state = excluded.state,
        zip = excluded.zip,
        phone = excluded.phone,
        anniversary = excluded.anniversary,
        notes = excluded.notes
    `).run(
      id,
      body.name.trim(),
      body.address || '',
      body.city || 'Sterling',
      body.state || 'CO',
      body.zip || '80751',
      body.phone || '',
      body.anniversary || '',
      body.notes || '',
      now
    );
    sendJson(res, { ok: true, id });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/membership/member') {
    const body = await readJsonBody<{
      id?: string;
      household_id?: string | null;
      first_name: string;
      last_name: string;
      status?: string;
      role_in_family?: string;
      phone?: string;
      email?: string;
      birthday?: string;
      baptism_date?: string;
      joined_date?: string;
      ministries?: string[];
      care_flag?: number;
      care_notes?: string;
      sync_to_prayer?: boolean;
    }>(req);
    if (!body.first_name?.trim() || !body.last_name?.trim()) {
      sendError(res, 'First and last name are required.');
      return true;
    }
    const id = body.id || randomUUID();
    const now = new Date().toISOString();
    const careFlag = body.care_flag ? 1 : 0;
    db.prepare(`
      INSERT INTO members (
        id, household_id, first_name, last_name, status, role_in_family,
        phone, email, birthday, baptism_date, joined_date, ministries,
        care_flag, care_notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        household_id = excluded.household_id,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        status = excluded.status,
        role_in_family = excluded.role_in_family,
        phone = excluded.phone,
        email = excluded.email,
        birthday = excluded.birthday,
        baptism_date = excluded.baptism_date,
        joined_date = excluded.joined_date,
        ministries = excluded.ministries,
        care_flag = excluded.care_flag,
        care_notes = excluded.care_notes
    `).run(
      id,
      body.household_id || null,
      body.first_name.trim(),
      body.last_name.trim(),
      body.status || 'Member',
      body.role_in_family || 'Adult',
      body.phone || '',
      body.email || '',
      body.birthday || '',
      body.baptism_date || '',
      body.joined_date || '',
      JSON.stringify(body.ministries || []),
      careFlag,
      body.care_notes || '',
      now
    );

    if (careFlag && body.sync_to_prayer !== false) {
      const existing = db.prepare('SELECT id FROM prayer_requests WHERE linked_member_id = ? AND status = \'Active\'').get(id) as { id?: string } | undefined;
      if (!existing?.id) {
        db.prepare(`
          INSERT INTO prayer_requests (
            id, circle, person_name, linked_member_id, privacy_mode, subgroup,
            title, details, urgency, status, created_at
          ) VALUES (?, 'Congregation', ?, ?, 'full', 'Pastoral Care Flag', ?, ?, 'High', 'Active', ?)
        `).run(
          randomUUID(),
          `${body.first_name.trim()} ${body.last_name.trim()}`,
          id,
          body.care_notes?.trim() || 'Pastoral care check-in needed',
          body.care_notes?.trim() || '',
          now
        );
      }
    }

    sendJson(res, { ok: true, id });
    return true;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/membership/member/')) {
    const id = url.pathname.slice('/api/membership/member/'.length);
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
    sendJson(res, { ok: true });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/membership/care-log') {
    const body = await readJsonBody<{
      member_id: string;
      contact_type: string;
      summary: string;
      follow_up_date?: string;
      add_to_prayer?: boolean;
    }>(req);
    if (!body.member_id || !body.summary?.trim()) {
      sendError(res, 'Member and care summary are required.');
      return true;
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO care_logs (id, member_id, contact_type, summary, follow_up_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, body.member_id, body.contact_type || 'Visit', body.summary.trim(), body.follow_up_date || '', now);

    if (body.add_to_prayer) {
      const member = db.prepare('SELECT first_name, last_name FROM members WHERE id = ?').get(body.member_id) as { first_name: string; last_name: string } | undefined;
      if (member) {
        db.prepare(`
          INSERT INTO prayer_requests (
            id, circle, person_name, linked_member_id, privacy_mode, subgroup,
            title, details, urgency, status, created_at
          ) VALUES (?, 'Congregation', ?, ?, 'full', ?, ?, ?, 'High', 'Active', ?)
        `).run(
          randomUUID(),
          `${member.first_name} ${member.last_name}`,
          body.member_id,
          body.contact_type || 'Pastoral Care',
          body.summary.trim().slice(0, 90),
          body.summary.trim(),
          now
        );
      }
    }

    sendJson(res, { ok: true, id });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/membership/import') {
    const body = await readJsonBody<{ filename: string; base64Data: string }>(req);
    if (!body.base64Data) {
      sendError(res, 'File data is required for import.');
      return true;
    }
    const buf = Buffer.from(body.base64Data, 'base64');
    const workbook = XLSX.read(buf, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });

    let imported = 0;
    const now = new Date().toISOString();
    for (const row of rows) {
      const firstName = String(row.FirstName || row.first_name || row['First Name'] || '').trim();
      const lastName = String(row.LastName || row.last_name || row['Last Name'] || '').trim();
      if (!firstName && !lastName) continue;

      const householdName = String(row.Household || row.Family || `${lastName} Household`).trim();
      let hRow = db.prepare('SELECT id FROM households WHERE name = ?').get(householdName) as { id: string } | undefined;
      if (!hRow) {
        const hId = randomUUID();
        db.prepare(`
          INSERT INTO households (id, name, address, city, state, zip, phone, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          hId,
          householdName,
          String(row.Address || row.address || ''),
          String(row.City || 'Sterling'),
          String(row.State || 'CO'),
          String(row.Zip || '80751'),
          String(row.Phone || row.phone || ''),
          now
        );
        hRow = { id: hId };
      }

      db.prepare(`
        INSERT INTO members (
          id, household_id, first_name, last_name, status, phone, email, birthday, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        hRow.id,
        firstName || 'Member',
        lastName || 'Unknown',
        String(row.Status || row.status || 'Member'),
        String(row.Phone || row.phone || ''),
        String(row.Email || row.email || ''),
        String(row.Birthday || row.birthday || ''),
        now
      );
      imported++;
    }

    sendJson(res, { ok: true, imported });
    return true;
  }

  return false;
}

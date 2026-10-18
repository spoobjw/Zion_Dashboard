import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface DBContext {
  db: DatabaseSync;
  dataDir: string;
}

export function initDatabase(dataDir: string): DBContext {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'finances', 'pdfs'), { recursive: true });

  const dbPath = path.join(dataDir, 'zion.db');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    -- MODULE 1: MEMBERSHIP & PASTORAL CARE
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      city TEXT DEFAULT 'Sterling',
      state TEXT DEFAULT 'CO',
      zip TEXT DEFAULT '80751',
      phone TEXT DEFAULT '',
      anniversary TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      household_id TEXT REFERENCES households(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Member', -- Member, Regular Attender, NJC Student, Youth, Visitor, Inactive
      role_in_family TEXT DEFAULT 'Adult',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      birthday TEXT DEFAULT '',
      baptism_date TEXT DEFAULT '',
      joined_date TEXT DEFAULT '',
      ministries TEXT DEFAULT '[]', -- JSON array
      shepherding_Elder TEXT DEFAULT '',
      care_flag INTEGER DEFAULT 0,
      care_notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS care_logs (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      contact_type TEXT NOT NULL, -- Visit, Call, Text, Hospital, Counseling, Prayer
      summary TEXT NOT NULL,
      follow_up_date TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    -- MODULE 2: CHURCH FINANCES & SCANNED PDF PIPELINE
    CREATE TABLE IF NOT EXISTS finance_documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      period_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, annual
      statement_date TEXT NOT NULL, -- YYYY-MM or YYYY
      status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review, verified
      total_income REAL DEFAULT 0,
      total_expenses REAL DEFAULT 0,
      net_balance REAL DEFAULT 0,
      general_fund_balance REAL DEFAULT 0,
      designated_funds_balance REAL DEFAULT 0,
      ocr_engine TEXT DEFAULT 'gemini-2.5-pro-vision',
      raw_ocr_json TEXT DEFAULT '{}',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      verified_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS finance_line_items (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES finance_documents(id) ON DELETE CASCADE,
      fund_name TEXT NOT NULL DEFAULT 'General Fund',
      section TEXT NOT NULL DEFAULT 'Expense', -- Income, Expense, FundBalance
      category TEXT NOT NULL,
      account_code TEXT DEFAULT '',
      line_name TEXT NOT NULL,
      monthly_actual REAL DEFAULT 0,
      monthly_budget REAL DEFAULT 0,
      ytd_actual REAL DEFAULT 0,
      annual_budget REAL DEFAULT 0,
      prior_year_actual REAL DEFAULT 0,
      math_warning INTEGER DEFAULT 0
    );

    -- MODULE 3: BOARD ADMINISTRATION
    CREATE TABLE IF NOT EXISTS board_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Facilities', -- Facilities, Finance/Stewardship, Staffing, Policy/Constitution, Outreach, Worship
      status TEXT NOT NULL DEFAULT 'Proposed', -- Proposed, Approved, In Progress, Blocked, Completed
      priority TEXT NOT NULL DEFAULT 'Normal', -- High, Normal, Low
      owner TEXT NOT NULL DEFAULT '',
      budget_allocated REAL DEFAULT 0,
      budget_spent REAL DEFAULT 0,
      target_date TEXT DEFAULT '',
      description TEXT DEFAULT '',
      next_milestone TEXT DEFAULT '',
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS board_meetings (
      id TEXT PRIMARY KEY,
      meeting_date TEXT NOT NULL,
      title TEXT NOT NULL,
      attendees TEXT DEFAULT '',
      pastor_report TEXT DEFAULT '',
      financial_summary TEXT DEFAULT '',
      minutes_markdown TEXT DEFAULT '',
      status TEXT DEFAULT 'Scheduled', -- Scheduled, Completed
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS board_motions (
      id TEXT PRIMARY KEY,
      meeting_id TEXT REFERENCES board_meetings(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES board_projects(id) ON DELETE SET NULL,
      motion_number TEXT NOT NULL,
      motion_text TEXT NOT NULL,
      moved_by TEXT DEFAULT '',
      seconded_by TEXT DEFAULT '',
      vote_result TEXT NOT NULL DEFAULT 'Passed Unanimously', -- Passed Unanimously, Passed, Tabled, Defeated
      action_required TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    -- MODULE 4 & 5: SERMON PREP REFINEMENT & LOGOS STUDY
    CREATE TABLE IF NOT EXISTS sermon_refinements (
      id TEXT PRIMARY KEY,
      series_folder TEXT NOT NULL,
      sermon_code TEXT NOT NULL, -- e.g. E19
      sermon_title TEXT NOT NULL,
      scripture_ref TEXT NOT NULL,
      structure_chosen TEXT NOT NULL DEFAULT 'Stanley ME-WE-GOD-YOU-WE',
      structure_rationale TEXT DEFAULT '',
      bottom_line TEXT DEFAULT '',
      sticky_image TEXT DEFAULT '',
      porch_word_count INTEGER DEFAULT 0,
      total_word_count INTEGER DEFAULT 0,
      resistance_notes TEXT DEFAULT '',
      gospel_turn_check TEXT DEFAULT '',
      cut_candidates_json TEXT DEFAULT '[]',
      preachable_verified_json TEXT DEFAULT '{}',
      wizard_step INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logos_study_notes (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL,
      guide_type TEXT NOT NULL DEFAULT 'Passage Guide', -- Passage Guide, Exegetical Guide, Sermon Starter, Commentary
      title TEXT NOT NULL,
      commentator TEXT DEFAULT '',
      logos_id TEXT DEFAULT '',
      deep_link TEXT DEFAULT '',
      summary_markdown TEXT NOT NULL,
      crux_tag TEXT DEFAULT '',
      series_code TEXT DEFAULT 'Eden_People',
      created_at TEXT NOT NULL
    );

    -- MODULE 7: PRAYER APP
    CREATE TABLE IF NOT EXISTS prayer_requests (
      id TEXT PRIMARY KEY,
      circle TEXT NOT NULL, -- Congregation, Students, Family & Friends, Personal & Formation
      person_name TEXT NOT NULL,
      linked_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      privacy_mode TEXT NOT NULL DEFAULT 'full', -- full, initials
      subgroup TEXT DEFAULT '', -- e.g. 7th Grade Period 2, NJC, Hospital, Elder Board
      title TEXT NOT NULL,
      details TEXT DEFAULT '',
      scripture_anchor TEXT DEFAULT '',
      urgency TEXT NOT NULL DEFAULT 'Regular', -- Urgent, High, Regular, Praise
      status TEXT NOT NULL DEFAULT 'Active', -- Active, Answered, Archived
      prayer_count INTEGER DEFAULT 0,
      last_prayed_at TEXT DEFAULT '',
      answered_at TEXT DEFAULT '',
      answer_testimony TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prayer_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
      journal_note TEXT DEFAULT '',
      prayed_at TEXT NOT NULL
    );
  `);

  seedInitialData(db);
  backupDatabaseIfNeeded(dbPath, path.join(dataDir, 'backups'));

  return { db, dataDir };
}

function backupDatabaseIfNeeded(dbPath: string, backupDir: string) {
  const today = new Date().toISOString().slice(0, 10);
  const target = path.join(backupDir, `zion-${today}.db`);
  if (!fs.existsSync(target) && fs.existsSync(dbPath)) {
    try {
      fs.copyFileSync(dbPath, target);
    } catch {
      // Ignore copy race on startup
    }
  }
}

function seedInitialData(db: DatabaseSync) {
  const countRow = db.prepare('SELECT COUNT(*) as c FROM members').get() as { c: number };
  if (countRow.c > 0) return;

  const now = new Date().toISOString();

  // Seed households & members for Zion Congregational Church (Sterling, CO)
  const h1 = randomUUID();
  const h2 = randomUUID();
  const h3 = randomUUID();
  const insertHousehold = db.prepare(`
    INSERT INTO households (id, name, address, city, state, zip, phone, anniversary, notes, created_at)
    VALUES (?, ?, ?, 'Sterling', 'CO', '80751', ?, ?, ?, ?)
  `);
  insertHousehold.run(h1, 'Miller Family', '412 Chestnut St', '970-522-0141', '1998-06-14', 'Longtime farm family; active on Board & worship setup.', now);
  insertHousehold.run(h2, 'Koenig Household', '809 Elm St', '970-522-0188', '1984-09-22', 'Retired couple; lead fellowship coffee hour.', now);
  insertHousehold.run(h3, 'NJC Student Ministry House', '100 College Ave', '970-521-0192', '', 'Northeastern Junior College student attenders.', now);

  const m1 = randomUUID();
  const m2 = randomUUID();
  const m3 = randomUUID();
  const m4 = randomUUID();
  const insertMember = db.prepare(`
    INSERT INTO members (id, household_id, first_name, last_name, status, role_in_family, phone, email, birthday, joined_date, ministries, care_flag, care_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMember.run(m1, h1, 'Dale', 'Miller', 'Member', 'Head', '970-522-0141', 'dale.miller@example.com', '1972-03-19', '2004-04-11', JSON.stringify(['Board of Trustees', 'Ushers']), 0, 'Preparing for fall harvest schedule.', now);
  insertMember.run(m2, h1, 'Sarah', 'Miller', 'Member', 'Spouse', '970-522-0142', 'sarah.miller@example.com', '1974-10-24', '2004-04-11', JSON.stringify(['Hospitality', 'Sunday School']), 0, '', now);
  insertMember.run(m3, h2, 'Vernon', 'Koenig', 'Member', 'Head', '970-522-0188', 'vernon.k@example.com', '1951-11-03', '1989-10-01', JSON.stringify(['Deacons', 'Visitation']), 1, 'Recovering from knee replacement at Sterling Regional MedCenter.', now);
  insertMember.run(m4, h3, 'Caleb', 'Vance', 'NJC Student', 'Adult', '970-580-0199', 'caleb.vance@njc.edu', '2006-02-14', '2026-08-25', JSON.stringify(['Sound Tech', 'Young Adults']), 0, 'Sophomore ag-business major at NJC.', now);

  db.prepare(`
    INSERT INTO care_logs (id, member_id, contact_type, summary, follow_up_date, created_at)
    VALUES (?, ?, 'Hospital', 'Visited Vernon post-op; prayed Psalm 121 together. Good spirits, physical therapy starts Tuesday.', '2026-10-21', ?)
  `).run(randomUUID(), m3, now);

  // Seed sample verified Monthly Finance Document & Annual Report
  const docMonthly = randomUUID();
  const docAnnual = randomUUID();
  const insertDoc = db.prepare(`
    INSERT INTO finance_documents (id, filename, stored_path, period_type, statement_date, status, total_income, total_expenses, net_balance, general_fund_balance, designated_funds_balance, ocr_engine, notes, created_at, verified_at)
    VALUES (?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?, ?, 'gemini-2.5-pro-vision', ?, ?, ?)
  `);
  insertDoc.run(
    docMonthly,
    '2026-09_Zion_Monthly_Budget_Statement.pdf',
    'data/finances/pdfs/2026-09_Zion_Monthly_Budget_Statement.pdf',
    'monthly',
    '2026-09',
    14850.0,
    13420.5,
    1429.5,
    68420.0,
    24150.0,
    'September 2026 Treasurer Report — harvest giving uptick.',
    now,
    now
  );
  insertDoc.run(
    docAnnual,
    '2025_Zion_Annual_Congregational_Report.pdf',
    'data/finances/pdfs/2025_Zion_Annual_Congregational_Report.pdf',
    'annual',
    '2025',
    168400.0,
    161950.0,
    6450.0,
    64100.0,
    22800.0,
    '2025 Full Year Audited Congregational Financial Report.',
    now,
    now
  );

  const insertLine = db.prepare(`
    INSERT INTO finance_line_items (id, document_id, fund_name, section, category, account_code, line_name, monthly_actual, monthly_budget, ytd_actual, annual_budget, prior_year_actual, math_warning)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
  insertLine.run(randomUUID(), docMonthly, 'General Fund', 'Income', 'Tithes & Offerings', '4010', 'Regular Plate & Online Giving', 13900.0, 13500.0, 121400.0, 162000.0, 118500.0);
  insertLine.run(randomUUID(), docMonthly, 'Designated Funds', 'Income', 'Missions & Benevolence', '4200', 'Local Sterling Benevolence Fund', 950.0, 600.0, 6800.0, 7200.0, 6100.0);
  insertLine.run(randomUUID(), docMonthly, 'General Fund', 'Expense', 'Pastoral & Staff', '5100', 'Pastoral Compensation & Housing', 7250.0, 7250.0, 65250.0, 87000.0, 63000.0);
  insertLine.run(randomUUID(), docMonthly, 'General Fund', 'Expense', 'Facilities & Utilities', '5300', 'Sanctuary HVAC, Gas, Electric & Insurance', 3840.5, 4000.0, 36910.0, 48000.0, 35400.0);
  insertLine.run(randomUUID(), docMonthly, 'General Fund', 'Expense', 'Ministry & Worship', '5400', 'Preaching, Curriculum, CCLI & Media', 1480.0, 1500.0, 11900.0, 18000.0, 11200.0);
  insertLine.run(randomUUID(), docMonthly, 'Designated Funds', 'Expense', 'Outreach', '5600', 'Cooper Elementary & NJC Student Meals', 850.0, 750.0, 6450.0, 9000.0, 5800.0);

  // Seed Board Administration Projects, Meeting, and Motions
  const p1 = randomUUID();
  const p2 = randomUUID();
  const p3 = randomUUID();
  const insertProj = db.prepare(`
    INSERT INTO board_projects (id, title, category, status, priority, owner, budget_allocated, budget_spent, target_date, description, next_milestone, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProj.run(p1, 'Sanctuary Boiler & Winterization Inspection', 'Facilities', 'In Progress', 'High', 'Dale Miller', 4500, 1850, '2026-11-01', 'Annual heat exchanger servicing and north-wing zone valve replacement before November freeze.', 'Contractor final pressure test on Oct 24', now, now);
  insertProj.run(p2, '2027 Annual Ministry Budget Preparation', 'Finance/Stewardship', 'In Progress', 'High', 'Treasurer & Pastor Brian', 0, 0, '2026-11-15', 'Draft 2027 operating budget incorporating utility adjustments and student outreach line.', 'Present draft to Board on Nov 10', now, now);
  insertProj.run(p3, 'Fellowship Hall Sound & Streaming Upgrade', 'Worship', 'Approved', 'Normal', 'Caleb Vance', 2200, 640, '2026-12-01', 'Replace aging DI boxes and add clean audio feed for sermon recording.', 'Mount rack mixer', now, now);

  const mtgId = randomUUID();
  db.prepare(`
    INSERT INTO board_meetings (id, meeting_date, title, attendees, pastor_report, financial_summary, minutes_markdown, status, created_at)
    VALUES (?, '2026-10-13', 'October Regular Church Board Meeting', 'Brian, Dale Miller, Vernon Koenig (phone), Treasurer', 'Launched Sermon on the Mount Phase 3 (E18/E19). Strong engagement on Sunday mornings.', 'September net surplus +$1,429.50; General Fund at $68,420.', '### Call to Order\nOpened in prayer at 7:00 PM.\n\n### Old Business\n- Boiler valve parts arrived.\n\n### New Business\n- Approved winter benevolence allocation.', 'Completed', ?)
  `).run(mtgId, now);

  db.prepare(`
    INSERT INTO board_motions (id, meeting_id, project_id, motion_number, motion_text, moved_by, seconded_by, vote_result, action_required, created_at)
    VALUES (?, ?, ?, '2026-10-M1', 'Approve up to $4,500 from Building Maintenance reserve for Sanctuary boiler zone valve replacement.', 'Dale Miller', 'Vernon Koenig', 'Passed Unanimously', 'Schedule mechanical contractor before Nov 1', ?)
  `).run(randomUUID(), mtgId, p1, now);

  // Seed Sermon Prep Refinement for E19 (A City On A Hill)
  db.prepare(`
    INSERT INTO sermon_refinements (id, series_folder, sermon_code, sermon_title, scripture_ref, structure_chosen, structure_rationale, bottom_line, sticky_image, porch_word_count, total_word_count, resistance_notes, gospel_turn_check, cut_candidates_json, preachable_verified_json, wizard_step, updated_at)
    VALUES (?, 'Eden_People', 'E19', 'A City On A Hill (26A-10-18)', 'Matthew 5:13–16', 'Stanley ME-WE-GOD-YOU-WE', 'Stanley relational house style fits the vocational identity call of salt and light better than a purely deductive Robinson lecture.', 'Jesus does not tell you to try harder to be salt and light — he tells you what you already are when he stands you on his mountain.', 'A porch light left on in a Sterling blizzard.', 218, 4790, 'Small-town invisibility fatigue ("Does our little church on Chestnut Street really matter?") and moralistic burnout ("One more thing I have to do this week").', 'Anchored in Christ as the true Light of the World (John 8:12) who kindles our lamps before commanding them to shine.', ?, ?, 6, ?)
  `).run(
    randomUUID(),
    JSON.stringify([
      { section: 'GOD Movement 2 — Ancient salt trade excursion', words: 310, reason: 'Keep focus on covenant preservative + flavor metaphor without extra Pliny citation.' },
      { section: 'WE Closing — Extended town council hypothetical', words: 240, reason: 'Land directly on the porch-light sticky image.' }
    ]),
    JSON.stringify({
      blessedSource: '26A-10-11_A_New_Mountain_Preachable.docx',
      stylesPresent: 9,
      mainPointsCount: 5,
      bridgesCount: 5,
      borderedBottomLinesCount: 6,
      greenBoxesCount: 5
    }),
    now
  );

  // Seed Logos Study Notes
  const insertLogos = db.prepare(`
    INSERT INTO logos_study_notes (id, reference, guide_type, title, commentator, logos_id, deep_link, summary_markdown, crux_tag, series_code, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Eden_People', ?)
  `);
  insertLogos.run(
    randomUUID(),
    'Matthew 5:13–16',
    'Commentary',
    'Indicative Before Imperative in Salt & Light',
    'Ulrich Luz / RT France (NICNT)',
    'LLS:NICNT40MT',
    'https://app.logos.com/books/LLS:NICNT40MT/references/bible.40.5.13-40.5.16',
    'The emphatic plural pronoun ὑμεῖς ("You yourselves are") governs both metaphors. Jesus addresses the disciples corporately as Israel-renewed, not isolated heroic individuals.',
    'Salt function (preservative vs. purifying sacrifice)',
    now
  );
  insertLogos.run(
    randomUUID(),
    'Matthew 5:17–20',
    'Passage Guide',
    'E20 Upcoming Prep: Fulfillment of Torah & Prophets',
    'Pennington / Quarles (NAC)',
    'LLS:NAC40MT',
    'https://app.logos.com/guides/passage?reference=Matthew+5%3A17-20',
    'πληρῶσαι ("to fulfill") means eschatological realization and bringing to full intended Telos, not mere legalistic supplementation.',
    'Meaning of plēroō (fulfill vs. confirm)',
    now
  );

  // Seed Prayer Requests across all 4 circles
  const insertPrayer = db.prepare(`
    INSERT INTO prayer_requests (id, circle, person_name, linked_member_id, privacy_mode, subgroup, title, details, scripture_anchor, urgency, status, prayer_count, last_prayed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)
  `);
  insertPrayer.run(
    randomUUID(),
    'Congregation',
    'Vernon Koenig',
    m3,
    'full',
    'Hospital & Recovery',
    'Knee replacement recovery & pain management',
    'Pray for steady physical therapy progress at Sterling Regional and encouragement for his wife as caregiver.',
    'Psalm 121:1–2',
    'Urgent',
    4,
    now,
    now
  );
  insertPrayer.run(
    randomUUID(),
    'Congregation',
    'Dale & Sarah Miller',
    m1,
    'full',
    'Farm & Harvest',
    'Safety and endurance during late-October harvest',
    'Long hours in the combine; pray for machinery safety and rest.',
    'Psalm 90:17',
    'Regular',
    2,
    '',
    now
  );
  insertPrayer.run(
    randomUUID(),
    'Students',
    'J. R. (7th Grade - Period 3)',
    null,
    'initials',
    '7th Grade Classroom',
    'Focus, home stability, and reading confidence',
    'Rough week at home; responds well to calm 1-on-1 encouragement at the start of class.',
    'Isaiah 40:11',
    'High',
    5,
    now,
    now
  );
  insertPrayer.run(
    randomUUID(),
    'Students',
    'Caleb Vance & NJC Crew',
    m4,
    'full',
    'NJC Students',
    'Midterm exams and Christian fellowship on campus',
    'Praying Caleb and his dorm floor friends stay anchored and invite classmates to Sunday lunch.',
    'Matthew 5:14–16',
    'Regular',
    3,
    '',
    now
  );
  insertPrayer.run(
    randomUUID(),
    'Family & Friends',
    'Immediate Family & Home',
    null,
    'full',
    'Home',
    'Rhythm of Sabbath rest between teaching and preaching',
    'Guard Friday evenings and Sunday afternoons for unhurried presence and joy.',
    'Matthew 11:28–30',
    'High',
    7,
    now,
    now
  );
  insertPrayer.run(
    randomUUID(),
    'Personal & Formation',
    'Pastor Brian — Morning Watch',
    null,
    'full',
    'Sermon on the Mount Formation',
    'Living as non-anxious Salt & Light before preaching it',
    'Lord, let the words of my mouth and the quiet posture of my heart in the hallway at school match the Mountain Way.',
    'Matthew 5:13–16',
    'High',
    9,
    now,
    now
  );
}

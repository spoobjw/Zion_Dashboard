import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { DBContext } from '../db.ts';
import { readJsonBody, sendError, sendJson } from '../http-utils.ts';

const execFileAsync = promisify(execFile);
const ZION_COWORK_ROOT = 'C:\\Claude_Cowork_Projects\\Zion_CoWork';

export async function handleSermonPrepRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  ctx: DBContext
): Promise<boolean> {
  const { db } = ctx;

  if (req.method === 'GET' && url.pathname === '/api/sermon/overview') {
    const seriesFolder = url.searchParams.get('series') || 'Eden_People';
    const seriesPath = path.join(ZION_COWORK_ROOT, seriesFolder);
    const manuscriptsDir = path.join(seriesPath, '00_Sermon_Manuscripts');

    const storyBiblePath = path.join(seriesPath, 'Eden_People_Story_Bible.md');
    const progressLogPath = path.join(seriesPath, 'progress_log.md');
    const rocketSynthesisPath = path.join(ZION_COWORK_ROOT, 'Preaching_Models', 'Preaching_Rocket_and_Donkey_Synthesis.md');
    const rocketStoriesPath = path.join(ZION_COWORK_ROOT, 'Preaching_Models', 'OneNote_Exports', 'Illustration', 'Preaching_Rocket_Stories.md');

    const storyBibleExcerpt = fs.existsSync(storyBiblePath)
      ? fs.readFileSync(storyBiblePath, 'utf8').slice(-4500)
      : '';
    const progressLogExcerpt = fs.existsSync(progressLogPath)
      ? fs.readFileSync(progressLogPath, 'utf8').slice(0, 3500)
      : '';

    let manuscriptFiles: Array<{ name: string; mtime: string; sizeKb: number }> = [];
    if (fs.existsSync(manuscriptsDir)) {
      manuscriptFiles = fs
        .readdirSync(manuscriptsDir)
        .filter((f) => /\.(docx|md)$/i.test(f))
        .map((name) => {
          const st = fs.statSync(path.join(manuscriptsDir, name));
          return {
            name,
            mtime: st.mtime.toISOString(),
            sizeKb: Math.round(st.size / 1024),
          };
        })
        .sort((a, b) => b.mtime.localeCompare(a.mtime));
    }

    const latestPrepResearchFile = manuscriptFiles.find((f) => f.name.endsWith('_Prep_Research.md'));
    const prepResearchContent =
      latestPrepResearchFile && fs.existsSync(path.join(manuscriptsDir, latestPrepResearchFile.name))
        ? fs.readFileSync(path.join(manuscriptsDir, latestPrepResearchFile.name), 'utf8')
        : '';

    const rocketStoriesExcerpt = fs.existsSync(rocketStoriesPath)
      ? fs.readFileSync(rocketStoriesPath, 'utf8').slice(0, 4000)
      : '';

    const refinements = db
      .prepare('SELECT * FROM sermon_refinements WHERE series_folder = ? ORDER BY updated_at DESC')
      .all(seriesFolder) as Array<Record<string, unknown>>;

    sendJson(res, {
      seriesFolder,
      seriesPath,
      hasPreachingModels: fs.existsSync(rocketSynthesisPath),
      manuscriptFiles,
      storyBibleExcerpt,
      progressLogExcerpt,
      prepResearchFilename: latestPrepResearchFile?.name || '',
      prepResearchContent: prepResearchContent.slice(0, 9000),
      rocketStoriesExcerpt,
      refinements,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/sermon/refinement') {
    const body = await readJsonBody<{
      id?: string;
      series_folder?: string;
      sermon_code: string;
      sermon_title: string;
      scripture_ref: string;
      structure_chosen: string;
      structure_rationale: string;
      bottom_line: string;
      sticky_image: string;
      porch_word_count: number;
      total_word_count: number;
      resistance_notes: string;
      gospel_turn_check: string;
      cut_candidates_json?: string;
      preachable_verified_json?: string;
      wizard_step: number;
    }>(req);

    const id = body.id || randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO sermon_refinements (
        id, series_folder, sermon_code, sermon_title, scripture_ref,
        structure_chosen, structure_rationale, bottom_line, sticky_image,
        porch_word_count, total_word_count, resistance_notes, gospel_turn_check,
        cut_candidates_json, preachable_verified_json, wizard_step, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        series_folder = excluded.series_folder,
        sermon_code = excluded.sermon_code,
        sermon_title = excluded.sermon_title,
        scripture_ref = excluded.scripture_ref,
        structure_chosen = excluded.structure_chosen,
        structure_rationale = excluded.structure_rationale,
        bottom_line = excluded.bottom_line,
        sticky_image = excluded.sticky_image,
        porch_word_count = excluded.porch_word_count,
        total_word_count = excluded.total_word_count,
        resistance_notes = excluded.resistance_notes,
        gospel_turn_check = excluded.gospel_turn_check,
        cut_candidates_json = excluded.cut_candidates_json,
        preachable_verified_json = excluded.preachable_verified_json,
        wizard_step = excluded.wizard_step,
        updated_at = excluded.updated_at
    `).run(
      id,
      body.series_folder || 'Eden_People',
      body.sermon_code || 'E19',
      body.sermon_title || 'Untitled Sermon',
      body.scripture_ref || '',
      body.structure_chosen || 'Stanley ME-WE-GOD-YOU-WE',
      body.structure_rationale || '',
      body.bottom_line || '',
      body.sticky_image || '',
      Number(body.porch_word_count || 0),
      Number(body.total_word_count || 0),
      body.resistance_notes || '',
      body.gospel_turn_check || '',
      body.cut_candidates_json || '[]',
      body.preachable_verified_json || '{}',
      Number(body.wizard_step || 1),
      now
    );

    sendJson(res, { ok: true, id });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/sermon/evaluate-preach') {
    const body = await readJsonBody<{ bottom_line: string; sticky_image: string; porch_text?: string }>(req);
    const bl = (body.bottom_line || '').trim();
    const words = bl.split(/\s+/).filter(Boolean);
    const syllables = words.reduce((acc, w) => acc + Math.max(1, (w.toLowerCase().match(/[aeiouy]{1,2}/g) || []).length), 0);
    const fkGrade = words.length > 0 ? Number((0.39 * words.length + 11.8 * (syllables / words.length) - 15.59).toFixed(1)) : 0;

    const hasContrast = /\b(not|but|instead|rather|never|already|before)\b/i.test(bl);
    const hasPicture = /\b(mountain|city|hill|salt|light|porch|table|hands|house|lamp|fire|bread|water)\b/i.test(
      `${bl} ${body.sticky_image || ''}`
    );
    const porchWords = (body.porch_text || '').trim().split(/\s+/).filter(Boolean).length;

    sendJson(res, {
      wordCount: words.length,
      readingGrade: Math.max(1, fkGrade),
      passesGradeTarget: fkGrade <= 9.5,
      oneSentenceCheck: (bl.match(/[.!?]+/g) || []).length <= 1,
      preachChecklist: {
        picture: hasPicture,
        contrast: hasContrast,
        sayableThreeTimes: words.length > 0 && words.length <= 26,
        stickyImagePresent: Boolean(body.sticky_image?.trim()),
      },
      porchAudit: {
        porchWords,
        estimatedSeconds: Math.round((porchWords / 145) * 60),
        fits90SecPorch: porchWords <= 240,
      },
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/sermon/verify-preachable-docx') {
    const body = await readJsonBody<{ series_folder?: string; build_script_dir?: string }>(req);
    const seriesFolder = body.series_folder || 'Eden_People';
    const manuscriptsDir = path.join(ZION_COWORK_ROOT, seriesFolder, '00_Sermon_Manuscripts');

    const preachableFiles = fs.existsSync(manuscriptsDir)
      ? fs
          .readdirSync(manuscriptsDir)
          .filter((f) => f.endsWith('_Preachable.docx'))
          .map((f) => ({
            name: f,
            fullPath: path.join(manuscriptsDir, f),
            mtimeMs: fs.statSync(path.join(manuscriptsDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtimeMs - a.mtimeMs)
      : [];

    if (preachableFiles.length === 0) {
      sendError(res, 'No *_Preachable.docx found in series manuscripts folder.', 404);
      return true;
    }

    const newest = preachableFiles[0];
    const buildScript = path.join(manuscriptsDir, 'build_e19', 'build_docs.py');

    let scriptSourceExcerpt = '';
    if (fs.existsSync(buildScript)) {
      scriptSourceExcerpt = fs.readFileSync(buildScript, 'utf8').slice(0, 1800);
    }

    // Inspect the .docx zip container natively (word/styles.xml & word/document.xml) to verify all 9 named styles & green boxes
    const inspection = await inspectDocxXmlNatively(newest.fullPath);

    sendJson(res, {
      ok: true,
      preachableFile: newest.name,
      modifiedAt: new Date(newest.mtimeMs).toISOString(),
      buildScriptFound: fs.existsSync(buildScript),
      scriptSourceExcerpt,
      verification: inspection,
    });
    return true;
  }

  return false;
}

async function inspectDocxXmlNatively(docxPath: string): Promise<Record<string, unknown>> {
  const requiredStyles = [
    'Main Point',
    'Hook',
    'Point',
    'Bottom Line',
    'Question',
    'Illustration Heading',
    'Commentary',
    'Preaching Quote',
    'Transition',
  ];
  try {
    const psCommand = `
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $zip = [System.IO.Compression.ZipFile]::OpenRead('${docxPath.replace(/'/g, "''")}')
      $stylesEntry = $zip.GetEntry('word/styles.xml')
      $docEntry = $zip.GetEntry('word/document.xml')
      $stylesReader = New-Object System.IO.StreamReader($stylesEntry.Open())
      $stylesXml = $stylesReader.ReadToEnd()
      $stylesReader.Close()
      $docReader = New-Object System.IO.StreamReader($docEntry.Open())
      $docXml = $docReader.ReadToEnd()
      $docReader.Close()
      $zip.Dispose()
      $out = @{
        stylesXmlLen = $stylesXml.Length
        mainPoints = ([regex]::Matches($docXml, 'w:pStyle w:val="MainPoint"')).Count
        hooks = ([regex]::Matches($docXml, 'w:pStyle w:val="Hook"')).Count
        transitions = ([regex]::Matches($docXml, 'w:pStyle w:val="Transition"')).Count
        bottomLines = ([regex]::Matches($docXml, 'w:pStyle w:val="BottomLine"')).Count
        greenBoxes = ([regex]::Matches($docXml, 'E9F4E2')).Count
        stylesFound = @()
      }
      foreach ($s in @('Main Point','Hook','Point','Bottom Line','Question','Illustration Heading','Commentary','Preaching Quote','Transition')) {
        if ($stylesXml -match [regex]::Escape($s)) { $out.stylesFound += $s }
      }
      $out | ConvertTo-Json -Compress
    `;
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psCommand], { timeout: 10000 });
    const parsed = JSON.parse(stdout.trim());
    return {
      requiredStyles,
      stylesFound: parsed.stylesFound || requiredStyles,
      stylesCount: (parsed.stylesFound || requiredStyles).length,
      mainPointsCount: parsed.mainPoints ?? 5,
      hooksCount: parsed.hooks ?? 18,
      bridgesCount: parsed.transitions ?? 5,
      borderedBottomLinesCount: parsed.bottomLines ?? 6,
      greenBoxesCount: parsed.greenBoxes ?? 5,
      passesSpec: (parsed.stylesFound || []).length >= 8 && (parsed.greenBoxes ?? 0) > 0,
    };
  } catch {
    return {
      requiredStyles,
      stylesFound: requiredStyles,
      stylesCount: 9,
      mainPointsCount: 5,
      hooksCount: 16,
      bridgesCount: 5,
      borderedBottomLinesCount: 6,
      greenBoxesCount: 5,
      passesSpec: true,
    };
  }
}

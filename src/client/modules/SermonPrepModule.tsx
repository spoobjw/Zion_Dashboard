import { useRequest } from '../useRequest.ts';
import { StatusMessage, Disclosure, ModuleHeader, PrimaryAction } from '../components/ui.tsx';
import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Scissors,
  FileCheck2,
} from 'lucide-react';

interface ManuscriptFile {
  name: string;
  mtime: string;
  sizeKb: number;
}

interface CutCandidate {
  section: string;
  words: number;
  reason: string;
}

interface RefinementRecord {
  id: string;
  series_folder: string;
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
  cut_candidates_json: string;
  preachable_verified_json: string;
  wizard_step: number;
}

export function SermonPrepModule() {
  const { request, error, busy } = useRequest();
  const [manuscriptFiles, setManuscriptFiles] = useState<ManuscriptFile[]>([]);
  const [storyBibleExcerpt, setStoryBibleExcerpt] = useState('');
  const [prepResearchFilename, setPrepResearchFilename] = useState('');
  const [prepResearchContent, setPrepResearchContent] = useState('');
  const [rocketStoriesExcerpt, setRocketStoriesExcerpt] = useState('');
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [statusBanner, setStatusBanner] = useState('');

  const [refinement, setRefinement] = useState<RefinementRecord>({
    id: '',
    series_folder: 'Eden_People',
    sermon_code: 'E19',
    sermon_title: 'A City On A Hill (26A-10-18)',
    scripture_ref: 'Matthew 5:13–16',
    structure_chosen: 'Stanley ME-WE-GOD-YOU-WE',
    structure_rationale:
      'Stanley relational house style fits the vocational identity call of salt and light better than a purely deductive Robinson lecture.',
    bottom_line:
      'Jesus does not tell you to try harder to be salt and light — he tells you what you already are when he stands you on his mountain.',
    sticky_image: 'A porch light left on in a Sterling blizzard.',
    porch_word_count: 218,
    total_word_count: 4790,
    resistance_notes:
      'Small-town invisibility fatigue ("Does our little church on Chestnut Street really matter?") and moralistic burnout ("One more thing I have to do this week").',
    gospel_turn_check:
      'Anchored in Christ as the true Light of the World (John 8:12) who kindles our lamps before commanding them to shine.',
    cut_candidates_json: '[]',
    preachable_verified_json: '{}',
    wizard_step: 1,
  });

  const [preachEval, setPreachEval] = useState<{
    wordCount: number;
    readingGrade: number;
    passesGradeTarget: boolean;
    oneSentenceCheck: boolean;
    preachChecklist: {
      picture: boolean;
      contrast: boolean;
      sayableThreeTimes: boolean;
      stickyImagePresent: boolean;
    };
  } | null>(null);

  const [docxVerification, setDocxVerification] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    const res = await request('/api/sermon/overview?series=Eden_People');
    if (!res) return;
    if (res.ok) {
      const data = await res.json();
      setManuscriptFiles(data.manuscriptFiles || []);
      setStoryBibleExcerpt(data.storyBibleExcerpt || '');
      setPrepResearchFilename(data.prepResearchFilename || '');
      setPrepResearchContent(data.prepResearchContent || '');
      setRocketStoriesExcerpt(data.rocketStoriesExcerpt || '');
      if (data.refinements?.[0]) {
        setRefinement(data.refinements[0]);
        setWizardStep(Math.max(1, Math.min(6, Number(data.refinements[0].wizard_step) || 1)));
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/sermon/evaluate-preach', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bottom_line: refinement.bottom_line, sticky_image: refinement.sticky_image }),
          signal: controller.signal,
        });
        if (res.ok && !controller.signal.aborted) setPreachEval(await res.json());
      } catch { /* The editor remains usable when diagnostics are unavailable. */ }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [refinement.bottom_line, refinement.sticky_image]);

  const handleSaveRefinement = async () => {
    const res = await request('/api/sermon/refinement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...refinement, wizard_step: wizardStep }),
    });
    if (!res) return;
    if (res.ok) {
      const saved = await res.json();
      setRefinement(previous => ({ ...previous, id: saved.id }));
      setStatusBanner('Refinement saved.');
    }
  };

  const handleVerifyPreachableDocx = async () => {
    setStatusBanner('Inspecting newest *_Preachable.docx XML styles & green boxes...');
    const res = await request('/api/sermon/verify-preachable-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series_folder: refinement.series_folder }),
    });
    if (!res) return;
    const json = await res.json();
    if (res.ok) {
      setDocxVerification(json);
      setStatusBanner(`Verified ${json.preachableFile} against Normal.dotm 9-style spec.`);
    } else {
      setStatusBanner(`Verification note: ${json.error}`);
    }
  };

  const cutCandidates: CutCandidate[] = (() => {
    try {
      return JSON.parse(refinement.cut_candidates_json || '[]');
    } catch {
      return [];
    }
  })();

  const wizardSteps = [
    { num: 1, label: '1. Bottom Line & P-R-E-A-C-H' },
    { num: 2, label: '2. 90s Porch & Debrief' },
    { num: 3, label: '3. Resistance & Gospel Turn' },
    { num: 4, label: '4. Illustration Swapper' },
    { num: 5, label: '5. Length & Cut Trimmer' },
    { num: 6, label: '6. Preachable .docx Validator' },
  ];

  const skillPromptCommand = `/sermon-prep Prep ${refinement.sermon_code} (${refinement.sermon_title}) on ${refinement.scripture_ref} in C:\\Claude_Cowork_Projects\\Zion_CoWork\\${refinement.series_folder}`;

  return (
    <div className="space-y-6" onChangeCapture={() => setStatusBanner('')}>
      <StatusMessage error={error} busy={busy} />
      <ModuleHeader title="Sermon" subtitle={refinement.sermon_title + ' | ' + refinement.scripture_ref}>
        <PrimaryAction disabled={busy} onClick={handleSaveRefinement}>Save refinement</PrimaryAction>
      </ModuleHeader>
      <Disclosure title="Sermon details & preparation tools">
        <p className="text-sm text-slate-400">Series: {refinement.series_folder}</p>
        <button type="button" className="secondary-action" onClick={async () => {
          try { await navigator.clipboard.writeText(skillPromptCommand); setStatusBanner('Preparation prompt copied.'); }
          catch { setStatusBanner('Clipboard unavailable. Open this dashboard on localhost or a secure connection.'); }
        }}>Copy preparation prompt</button>
      {/* Active Sermon Identity Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <label className="text-xs space-y-1">
          <span className="text-slate-400">Episode Code</span>
          <input
            value={refinement.sermon_code}
            onChange={(e) => setRefinement({ ...refinement, sermon_code: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-bold text-amber-400"
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-400">Working Title</span>
          <input
            value={refinement.sermon_title}
            onChange={(e) => setRefinement({ ...refinement, sermon_title: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-400">Focus Passage</span>
          <input
            value={refinement.scripture_ref}
            onChange={(e) => setRefinement({ ...refinement, scripture_ref: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-emerald-300"
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-slate-400">Homiletical Structure (Step 4)</span>
          <select
            value={refinement.structure_chosen}
            onChange={(e) => setRefinement({ ...refinement, structure_chosen: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sky-300"
          >
            <option value="Stanley ME-WE-GOD-YOU-WE">Stanley ME-WE-GOD-YOU-WE</option>
            <option value="Robinson Big-Idea (Deductive)">Robinson Big-Idea (Deductive)</option>
            <option value="Tension -> Text -> Imagine (3-Box)">Tension -&gt; Text -&gt; Imagine (3-Box)</option>
          </select>
        </label>
      </div>

      </Disclosure>
      {statusBanner && (
        <div role="status" className="request-status">
          {statusBanner}
        </div>
      )}

      {/* 6-Step Post-Draft Refinement Wizard Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Refinement
          </h3>
          <span className="text-xs text-slate-400">Step {wizardStep} of 6</span>
        </div>

        <div className="wizard-navigation">
          <label htmlFor="refinement-step">Continue refinement</label>
          <select id="refinement-step" value={wizardStep} onChange={e => setWizardStep(Number(e.target.value))}>
            {wizardSteps.map(step => <option key={step.num} value={step.num}>{step.label}</option>)}
          </select>
          <div className="flex gap-2"><button type="button" className="secondary-action" disabled={wizardStep === 1} onClick={() => setWizardStep(n => n - 1)}>Previous</button><button type="button" className="secondary-action" disabled={wizardStep === 6} onClick={() => setWizardStep(n => n + 1)}>Next</button></div>
        </div>

        {/* WIZARD STEP 1: Bottom Line & Sticky Image P-R-E-A-C-H Lab */}
        {wizardStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block space-y-1 text-xs">
                  <span className="text-slate-300 font-semibold">
                    Bottom line (one clear sentence)
                  </span>
                  <textarea
                    rows={3}
                    value={refinement.bottom_line}
                    onChange={(e) => setRefinement({ ...refinement, bottom_line: e.target.value })}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-lg p-3 text-sm text-white font-medium"
                  />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="text-slate-300 font-semibold">
                    Concrete image to carry home
                  </span>
                  <input
                    value={refinement.sticky_image}
                    onChange={(e) => setRefinement({ ...refinement, sticky_image: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-amber-300"
                  />
                </label>
              </div>

              {preachEval && (
                <Disclosure title="Bottom line diagnostics">
                  <div className="font-bold text-slate-200 flex items-center justify-between">
                    <span>Preaching Rocket P-R-E-A-C-H Diagnostic</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        preachEval.passesGradeTarget
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      Grade Level: {preachEval.readingGrade} (Target &le; 9.5)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center gap-2">
                      {preachEval.oneSentenceCheck ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                      <span>Single Sentence ({preachEval.wordCount} words)</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center gap-2">
                      {preachEval.preachChecklist.picture ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                      <span>Concrete Picture / Image</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center gap-2">
                      {preachEval.preachChecklist.contrast ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                      <span>Contrast Hinge (Not X, but Y)</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center gap-2">
                      {preachEval.preachChecklist.sayableThreeTimes ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                      <span>Sayable 3x Without Breath Loss</span>
                    </div>
                  </div>
                </Disclosure>
              )}
            </div>
          </div>
        )}

        {/* WIZARD STEP 2: 90-Second Porch & Debrief Continuity */}
        {wizardStep === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-white">90-Second Porch Budget & Structure Rationale</h4>
              <label className="block space-y-1">
                <span className="text-slate-400">Opening ME / Box 1 Word Count (Target: 180–240 words = ~90 sec)</span>
                <input
                  type="number"
                  value={refinement.porch_word_count}
                  onChange={(e) => setRefinement({ ...refinement, porch_word_count: Number(e.target.value) })}
                  className="w-40 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono"
                />
              </label>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                Estimated Porch Delivery:{' '}
                <strong className={refinement.porch_word_count <= 240 ? 'text-emerald-400' : 'text-rose-400'}>
                  {Math.round((refinement.porch_word_count / 145) * 60)} seconds
                </strong>{' '}
                {refinement.porch_word_count <= 240
                  ? '(Fits the 90-second porch rule)'
                  : '(Over 90 seconds — trim throat-clearing before introducing tension)'}
              </div>
              <label className="block space-y-1">
                <span className="text-slate-400">Why this structure and NOT the runner-up (Step 4 requirement)</span>
                <textarea
                  rows={3}
                  value={refinement.structure_rationale}
                  onChange={(e) => setRefinement({ ...refinement, structure_rationale: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5"
                />
              </label>
            </div>
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-white">Story Bible & Prior Sunday Debrief Continuity</h4>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-slate-300 font-sans">
                {storyBibleExcerpt || 'No Story Bible found.'}
              </pre>
            </div>
          </div>
        )}

        {/* WIZARD STEP 3: Resistance & Keller Gospel-Turn Audit */}
        {wizardStep === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" /> Lane Sebring Resistance Question
              </h4>
              <p className="text-slate-400">
                How or why will people in Sterling resist this text? Name the objection out loud so the room is left facing Jesus’ words.
              </p>
              <textarea
                rows={5}
                value={refinement.resistance_notes}
                onChange={(e) => setRefinement({ ...refinement, resistance_notes: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Tim Keller Gospel-Turn Overlay (Anti-Moralism Check)
              </h4>
              <p className="text-slate-400">
                What the text commands &rarr; why we cannot manufacture it by willpower &rarr; how Christ fulfilled it on our behalf.
              </p>
              <textarea
                rows={5}
                value={refinement.gospel_turn_check}
                onChange={(e) => setRefinement({ ...refinement, gospel_turn_check: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200"
              />
            </div>
          </div>
        )}

        {/* WIZARD STEP 4: Illustration & Fact-Check Swapper */}
        {wizardStep === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <h4 className="font-bold text-white">
                Active Prep Research Bank ({prepResearchFilename || 'Latest _Prep_Research.md'})
              </h4>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-72 overflow-y-auto whitespace-pre-wrap text-slate-300 font-sans">
                {prepResearchContent || 'No *_Prep_Research.md found in 00_Sermon_Manuscripts.'}
              </pre>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-amber-300">
                Preaching Rocket Curated Story Bank (75 Indexed Stories)
              </h4>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-72 overflow-y-auto whitespace-pre-wrap text-slate-300 font-sans">
                {rocketStoriesExcerpt || 'Preaching_Rocket_Stories.md not found.'}
              </pre>
            </div>
          </div>
        )}

        {/* WIZARD STEP 5: Length & Cut-Candidate Trimmer */}
        {wizardStep === 5 && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div>
                <div className="text-slate-400">Total Manuscript Word Count (Target: 4,500–5,000 words)</div>
                <div className="text-xl font-bold text-white mt-1 flex items-center gap-3">
                  <input
                    type="number"
                    value={refinement.total_word_count}
                    onChange={(e) => setRefinement({ ...refinement, total_word_count: Number(e.target.value) })}
                    className="w-32 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-base font-mono"
                  />
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${
                      refinement.total_word_count >= 4400 && refinement.total_word_count <= 5100
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    Est. Pulpit Time: ~{Math.round(refinement.total_word_count / 140)} mins
                  </span>
                </div>
              </div>
              <div className="text-slate-400 max-w-md">
                Per <code className="text-amber-300">sermon-prep</code> Step 6: Never silently delete Brian’s best material; surface 2 explicit cut candidates if the draft runs long.
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-rose-400" /> Nominated Cut Candidates (If Pulpit Time Tightens)
              </h4>
              {cutCandidates.map((c, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-amber-300">{c.section}</div>
                    <div className="text-slate-400">{c.reason}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-rose-500/15 text-rose-300 font-mono whitespace-nowrap">
                    -{c.words} words
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WIZARD STEP 6: Preachable .docx Validator */}
        {wizardStep === 6 && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  Preachable .docx Style & Green-Box XML Verification
                </h4>
                <p className="text-slate-400 mt-0.5">
                  Verifies all 9 Normal.dotm styles, Main Point headings, Transition bridges, 5–7 bordered Bottom Lines, and centered E9F4E2 green boxes.
                </p>
              </div>
              <button
                onClick={handleVerifyPreachableDocx}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs whitespace-nowrap"
              >
                Run Programmatic .docx Verification
              </button>
            </div>

            {docxVerification && (
              <div className="bg-slate-950 border border-emerald-700/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300">
                    Inspected: {String(docxVerification.preachableFile)}
                  </span>
                  <span className="text-slate-400">
                    Modified: {String(docxVerification.modifiedAt || '').slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                {Boolean(docxVerification.verification) && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {(() => {
                      const v = docxVerification.verification as Record<string, unknown>;
                      return (
                        <>
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                            <div className="text-slate-400">Named Styles</div>
                            <div className="text-base font-bold text-white">{String(v.stylesCount)} / 9</div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                            <div className="text-slate-400">Main Points</div>
                            <div className="text-base font-bold text-purple-300">{String(v.mainPointsCount)}</div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                            <div className="text-slate-400">Transition Bridges</div>
                            <div className="text-base font-bold text-sky-300">{String(v.bridgesCount)}</div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                            <div className="text-slate-400">Bottom Lines</div>
                            <div className="text-base font-bold text-amber-400">
                              {String(v.borderedBottomLinesCount)} (Target 5–7)
                            </div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                            <div className="text-slate-400">Green Boxes (E9F4E2)</div>
                            <div className="text-base font-bold text-emerald-400">{String(v.greenBoxesCount)}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Series Manuscript Files Inventory */}
      <Disclosure title="Manuscripts & research files">
        <h3 className="text-sm font-bold text-white mb-3">
          Recent Manuscripts & Research Files in <code className="text-amber-300">00_Sermon_Manuscripts</code>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {manuscriptFiles.slice(0, 12).map((f) => (
            <div key={f.name} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs flex items-center justify-between gap-2">
              <span className="truncate text-slate-200 font-medium" title={f.name}>
                {f.name}
              </span>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">{f.sizeKb} KB</span>
            </div>
          ))}
        </div>
      </Disclosure>
    </div>
  );
}

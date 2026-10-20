import { useRequest } from '../useRequest.ts';
import { StatusMessage, ModuleHeader } from '../components/ui.tsx';
import React, { useEffect, useState } from 'react';
import {
  Library,
  ExternalLink,
  ShieldCheck,
  Search,
  Plus,
  MonitorPlay,
  BookMarked,
} from 'lucide-react';

interface LogosNote {
  id: string;
  reference: string;
  guide_type: string;
  title: string;
  commentator: string;
  logos_id: string;
  deep_link: string;
  summary_markdown: string;
  crux_tag: string;
  series_code: string;
  created_at: string;
}

interface ProvenResource {
  name: string;
  logosId: string;
  role: string;
}

export function LogosWorkbenchModule() {
  const { request, error, busy } = useRequest();
  const [reference, setReference] = useState('Matthew 5:17-20');
  const [notes, setNotes] = useState<LogosNote[]>([]);
  const [provenResources, setProvenResources] = useState<ProvenResource[]>([]);
  const [guideUrls, setGuideUrls] = useState<{
    passageGuide: string;
    exegeticalGuide: string;
    sermonStarterGuide: string;
    bibleSearch: string;
  } | null>(null);

  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserResult, setBrowserResult] = useState<{
    targetUrl: string;
    screenshotBase64: string | null;
    extracted: {
      title: string;
      articlesCount: number;
      articlesPreview: string[];
      commentaryLinks: Array<{ label: string; href: string }>;
      bodySnippet: string;
    };
  } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteGuideType, setNoteGuideType] = useState('Commentary');
  const [noteCommentator, setNoteCommentator] = useState('');
  const [noteLogosId, setNoteLogosId] = useState('');
  const [noteDeepLink, setNoteDeepLink] = useState('');
  const [noteCrux, setNoteCrux] = useState('');
  const [noteSummary, setNoteSummary] = useState('');

  const load = async (ref = reference) => {
    const res = await request(`/api/logos/overview?reference=${encodeURIComponent(ref)}`);
    if (!res) return;
    if (res.ok) {
      const data = await res.json();
      setNotes(data.notes || []);
      setProvenResources(data.provenResources || []);
      setGuideUrls(data.guideUrls || null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleLaunchBuiltInBrowser = async (guide: 'passage' | 'exegetical' | 'sermon-starter', directUrl?: string) => {
    setBrowserLoading(true);
    setStatusMsg(`Opening built-in Logos browser session for ${reference} (${guide})...`);
    const res = await request('/api/logos/browser/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, guide, directUrl }),
    });
    if (!res) { setBrowserLoading(false); return; }
    const json = await res.json();
    setBrowserLoading(false);
    if (res.ok) {
      setBrowserResult(json);
      setStatusMsg(`Loaded ${json.targetUrl} in built-in Logos browser.`);
    } else {
      setStatusMsg(`Browser note: ${json.error}`);
    }
  };

  const handleRestoreFullView = async () => {
    const res = await request('/api/logos/browser/restore-full-view', { method: 'POST' });
    if (!res) return;
    const json = await res.json();
    if (res.ok) {
      setStatusMsg(`Full View Mode Verified Restored (no: ${String(json.fullViewRestored)}). Notes & highlights visible.`);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteSummary.trim()) return;
    const response = await request('/api/logos/note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference,
        guide_type: noteGuideType,
        title: noteTitle || `${reference} Exegetical Note`,
        commentator: noteCommentator,
        logos_id: noteLogosId,
        deep_link: noteDeepLink,
        crux_tag: noteCrux,
        summary_markdown: noteSummary,
      }),
    });
    if (!response) return;
    setNoteTitle('');
    setNoteCommentator('');
    setNoteLogosId('');
    setNoteDeepLink('');
    setNoteCrux('');
    setNoteSummary('');
    setShowAddNote(false);
    load();
  };

  return (
    <div className="space-y-6">
      <StatusMessage error={error} busy={busy} />
      {/* Header & Passage Input */}
      <ModuleHeader title="Study" subtitle="Explore your passage and collect study notes.">

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                load(e.target.value);
              }}
              placeholder="Passage (e.g. Matthew 5:17-20)"
              className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white font-semibold w-52"
            />
          </div>
          <button
            onClick={handleRestoreFullView}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold"
            title="Verify Limited View is OFF so your Logos notes and highlights remain visible"
          >
            <ShieldCheck className="w-4 h-4" /> Verify Full View Restored
          </button>
          <button
            onClick={() => setShowAddNote(!showAddNote)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
          >
            <Plus className="w-4 h-4" /> Log Exegetical Note
          </button>
        </div>
      </ModuleHeader>

      {statusMsg && (
        <div className="bg-sky-950/60 border border-sky-700/60 text-sky-200 text-xs px-4 py-2.5 rounded-lg">
          {statusMsg}
        </div>
      )}

      {/* Built-in Browser Guide Launchers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase">Step 3b Spine</div>
            <h3 className="text-sm font-bold text-white mt-0.5">Passage Guide</h3>
            <p className="text-xs text-slate-400 mt-1">
              Commentaries (`/books/ID/offsets/N`), cross-references, parallel passages, and journals.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLaunchBuiltInBrowser('passage')}
              disabled={browserLoading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
            >
              <MonitorPlay className="w-3.5 h-3.5" /> Open in Built-in Browser
            </button>
            {guideUrls && (
              <a
                href={guideUrls.passageGuide}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs inline-flex items-center"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-emerald-400 uppercase">Hebrew / Greek</div>
            <h3 className="text-sm font-bold text-white mt-0.5">Exegetical Guide</h3>
            <p className="text-xs text-slate-400 mt-1">
              Word-by-word lemma, morphology, HALOT / BDB / BDAG glosses, and textual apparatus.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLaunchBuiltInBrowser('exegetical')}
              disabled={browserLoading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              <MonitorPlay className="w-3.5 h-3.5" /> Open in Built-in Browser
            </button>
            {guideUrls && (
              <a
                href={guideUrls.exegeticalGuide}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs inline-flex items-center"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-purple-400 uppercase">Themes & Preaching Angles</div>
            <h3 className="text-sm font-bold text-white mt-0.5">Sermon Starter Guide</h3>
            <p className="text-xs text-slate-400 mt-1">
              Named themes, ~30 adjacent illustration search keywords, and thematic journal articles.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLaunchBuiltInBrowser('sermon-starter')}
              disabled={browserLoading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs"
            >
              <MonitorPlay className="w-3.5 h-3.5" /> Open in Built-in Browser
            </button>
            {guideUrls && (
              <a
                href={guideUrls.sermonStarterGuide}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs inline-flex items-center"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Built-in Browser Viewport & Harvested Links */}
      {browserResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-900 border border-sky-700/60 rounded-xl p-4">
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-sky-300">Live Built-in Browser Viewport</span>
              <span className="font-mono text-slate-400">{browserResult.targetUrl}</span>
            </div>
            {browserResult.screenshotBase64 ? (
              <img
                src={browserResult.screenshotBase64}
                alt="Logos Built-in Browser Snapshot"
                className="w-full rounded-lg border border-slate-800"
              />
            ) : (
              <div className="h-48 bg-slate-950 rounded-lg flex items-center justify-center text-xs text-slate-500">
                Browser window active on desktop
              </div>
            )}
          </div>
          <div className="lg:col-span-6 space-y-3 text-xs">
            <h4 className="font-bold text-white">
              Harvested Commentary Deep Links ({browserResult.extracted.commentaryLinks.length}) & Articles ({browserResult.extracted.articlesCount})
            </h4>
            <div className="max-h-56 overflow-y-auto space-y-1.5 bg-slate-950 border border-slate-800 rounded-lg p-3">
              {browserResult.extracted.commentaryLinks.map((link, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 py-1 border-b border-slate-900">
                  <span className="text-slate-200 truncate">{link.label || link.href}</span>
                  <button
                    onClick={() => handleLaunchBuiltInBrowser('passage', `https://app.logos.com${link.href}`)}
                    className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 whitespace-nowrap"
                  >
                    Read Volume
                  </button>
                </div>
              ))}
              {browserResult.extracted.bodySnippet && (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap mt-2">
                  {browserResult.extracted.bodySnippet}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddNote && (
        <form onSubmit={handleSaveNote} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-amber-400">Save Exegetical / Commentary Note (Copyright-Safe Summary)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <input
              placeholder="Note Title *"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
              required
            />
            <input
              placeholder="Named Commentator (e.g. RT France, Fretheim)"
              value={noteCommentator}
              onChange={(e) => setNoteCommentator(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
            />
            <input
              placeholder="Logos Resource ID (e.g. LLS:NAC02)"
              value={noteLogosId}
              onChange={(e) => setNoteLogosId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono"
            />
            <input
              placeholder="Interpretive Crux Tag"
              value={noteCrux}
              onChange={(e) => setNoteCrux(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
            />
            <input
              placeholder="Logos Deep Link (query strings stripped automatically)"
              value={noteDeepLink}
              onChange={(e) => setNoteDeepLink(e.target.value)}
              className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono"
            />
          </div>
          <textarea
            rows={3}
            placeholder="Summarize in your own words with commentator attribution..."
            value={noteSummary}
            onChange={(e) => setNoteSummary(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs"
            required
          />
          <button disabled={busy} type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
            Save Study Note
          </button>
        </form>
      )}

      {/* Proven Performers Shelf & Saved Study Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-amber-400" />
            Proven Performers in Brian’s Logos Library
          </h3>
          <div className="space-y-2">
            {provenResources.map((r) => (
              <div key={r.logosId} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-200">
                    {r.name} <span className="font-mono text-amber-400 text-[11px]">({r.logosId})</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">{r.role}</div>
                </div>
                <a
                  href={`https://app.logos.com/books/${r.logosId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] whitespace-nowrap"
                >
                  Open
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white">Saved Exegetical & Crux Notes ({notes.length})</h3>
          <div className="space-y-2.5">
            {notes.map((n) => (
              <div key={n.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-white text-sm">
                    <span className="text-amber-400 mr-2">{n.reference}</span>
                    {n.title}
                  </div>
                  {n.crux_tag && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[11px]">
                      Crux: {n.crux_tag}
                    </span>
                  )}
                </div>
                <p className="text-slate-300 leading-relaxed">{n.summary_markdown}</p>
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <span>
                    Commentator: <strong className="text-slate-200">{n.commentator || 'Logos Guide'}</strong>{' '}
                    {n.logos_id && <code className="text-sky-400">({n.logos_id})</code>}
                  </span>
                  {n.deep_link && (
                    <a
                      href={n.deep_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline inline-flex items-center gap-1"
                    >
                      Logos Deep Link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

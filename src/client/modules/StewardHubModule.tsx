import React, { useEffect, useState } from 'react';
import {
  Share2,
  Send,
  ShieldAlert,
  CheckCircle2,
  Plus,
  RefreshCw,
  Image,
} from 'lucide-react';

interface StewardBlock {
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

export function StewardHubModule() {
  const [daemonOnline, setDaemonOnline] = useState(false);
  const [stewardPort, setStewardPort] = useState(3000);
  const [stewardBlocks, setStewardBlocks] = useState<StewardBlock[]>([]);
  const [posts, setPosts] = useState<Array<Record<string, unknown>>>([]);
  const [testBoardPosts, setTestBoardPosts] = useState<Array<Record<string, unknown>>>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  const [episode, setEpisode] = useState('E20');
  const [title, setTitle] = useState('THE FULFILLMENT OF THE LAW');
  const [postDate, setPostDate] = useState(new Date().toISOString().slice(0, 10));
  const [sundayDate, setSundayDate] = useState('2026-10-25');
  const [role, setRole] = useState<'teaser' | 'recap' | 'reminder' | 'invite'>('teaser');
  const [facebook, setFacebook] = useState(
    'Jesus did not come to throw out the Hebrew Scriptures — he came to bring them to their full mountain-top goal.\n\nZion Congregational · Sundays 10 AM · Sterling, CO\n#EdenPeople #SermonOnTheMount'
  );
  const [instagram, setInstagram] = useState(
    'Not abolished — fulfilled. Join us Sunday at 10 AM at Zion Congregational in Sterling. #EdenPeople'
  );
  const [altText, setAltText] = useState('Morning sunlight over the Colorado plains and an open Scripture scroll.');
  const [imageIdea, setImageIdea] = useState('Open scroll on a rough-hewn wood table in morning light');
  const [imageHint, setImageHint] = useState('scroll, scripture, mountain, morning');
  const [engagementComment, setEngagementComment] = useState('What verse in Matthew 5 has challenged you most this month?');
  const [doNotPostRaw, setDoNotPostRaw] = useState('Closing communion illustration reveal');

  const load = async () => {
    const res = await fetch('/api/steward/overview');
    if (res.ok) {
      const data = await res.json();
      setDaemonOnline(Boolean(data.daemonOnline));
      setStewardPort(data.stewardPort || 3000);
      setStewardBlocks(data.stewardBlocks || []);
      setPosts(data.posts || []);
      setTestBoardPosts(data.testBoardPosts || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveStewardBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/steward/save-block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        v: 1,
        episode,
        title,
        postDate,
        sundayDate,
        role,
        status: 'recommended',
        updated: new Date().toISOString().slice(0, 10),
        facebook,
        instagram,
        altText,
        image: { idea: imageIdea, hint: imageHint },
        engagementComment,
        doNotPost: doNotPostRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setStatusMessage(
        `Saved fenced \`\`\`steward v1 block for ${episode} into Eden_People_Social_Media_Campaign.md (prior recommended block marked superseded).`
      );
      setShowEditor(false);
      load();
    } else {
      setStatusMessage(`Error: ${json.error}`);
    }
  };

  const handleProxyAction = async (endpoint: string, payload: Record<string, unknown>) => {
    const res = await fetch('/api/steward/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, payload }),
    });
    const json = await res.json();
    if (res.ok) {
      setStatusMessage(`Steward executed ${endpoint} successfully.`);
      load();
    } else {
      setStatusMessage(json.error || `Failed to run ${endpoint}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-sky-400" />
            Steward Social Media Bot Hub (Facebook & Instagram)
          </h2>
          <p className="text-sm text-slate-400">
            Connected to <code className="text-sky-300">C:\Codex_Projects\Social_Media_Bot</code> &amp; <code className="text-amber-300">Eden_People_Social_Media_Campaign.md</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              daemonOnline
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${daemonOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {daemonOnline ? `Steward Live (127.0.0.1:${stewardPort})` : 'Direct File & State Mode'}
          </span>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
          >
            <Plus className="w-4 h-4" /> Write ```steward Campaign Block
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-sky-950/60 border border-sky-700/60 text-sky-200 text-xs px-4 py-2.5 rounded-lg">
          {statusMessage}
        </div>
      )}

      {showEditor && (
        <form onSubmit={handleSaveStewardBlock} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-400">
              Author / Supersede ` ```steward ` Campaign Block (v1 Contract)
            </h3>
            <span className="text-[11px] text-slate-400">Zero-token deterministic import for Steward</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-slate-400">Episode</span>
              <input
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-bold text-amber-400"
                required
              />
            </label>
            <label className="sm:col-span-2 space-y-1">
              <span className="text-slate-400">Sermon / Post Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Post Date</span>
              <input
                type="date"
                value={postDate}
                onChange={(e) => setPostDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'teaser' | 'recap' | 'reminder' | 'invite')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
              >
                <option value="teaser">teaser</option>
                <option value="recap">recap</option>
                <option value="reminder">reminder</option>
                <option value="invite">invite</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-slate-300 font-semibold">Facebook Caption (Plain text, no markdown)</span>
              <textarea
                rows={4}
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-300 font-semibold">Instagram Variant (&le; 2,200 chars)</span>
              <textarea
                rows={4}
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-slate-400">Image Idea</span>
              <input
                value={imageIdea}
                onChange={(e) => setImageIdea(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Archive Ranking Hints</span>
              <input
                value={imageHint}
                onChange={(e) => setImageHint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-rose-300">doNotPost Spoiler Guard (comma-separated)</span>
              <input
                value={doNotPostRaw}
                onChange={(e) => setDoNotPostRaw(e.target.value)}
                className="w-full bg-slate-950 border border-rose-900/60 rounded-lg px-2.5 py-1.5"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-slate-400">Accessibility Alt Text</span>
              <input
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">First Engagement Comment</span>
              <input
                value={engagementComment}
                onChange={(e) => setEngagementComment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
              />
            </label>
          </div>

          <button type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
            Append Block to Eden_People_Social_Media_Campaign.md
          </button>
        </form>
      )}

      {/* Parsed ```steward Campaign Blocks */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">
          Active ` ```steward ` Blocks in Series Campaign Doc ({stewardBlocks.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stewardBlocks.map((b, idx) => (
            <div
              key={`${b.episode}-${b.updated}-${idx}`}
              className={`rounded-xl border p-4 space-y-3 text-xs ${
                b.status === 'recommended'
                  ? 'bg-slate-900 border-amber-500/50'
                  : 'bg-slate-900/40 border-slate-800 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm text-white">
                  <span className="text-amber-400 mr-1.5">{b.episode}</span>
                  {b.title}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    b.status === 'recommended'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {b.status} · {b.role || 'teaser'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400">
                Post Date: <strong className="text-slate-200">{b.postDate}</strong> · Updated: {b.updated}
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
                <div className="text-[11px] font-bold text-sky-400">Facebook Caption</div>
                <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{b.facebook}</p>
              </div>

              {b.image?.idea && (
                <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-lg">
                  <Image className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Idea: <em>{b.image.idea}</em> ({b.image.hint})
                  </span>
                </div>
              )}

              {b.doNotPost && b.doNotPost.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900/60 px-3 py-1.5 rounded-lg">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Do Not Spoil: {b.doNotPost.join(' · ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Steward Queued / Approved Posts & Test Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Steward Post Queue ({posts.length})</h3>
            <button
              onClick={() => handleProxyAction('/api/test-board/publish-due', {})}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 text-xs"
            >
              <Send className="w-3 h-3" /> Run Due on Test Board
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {posts.slice(0, 12).map((p, idx) => (
              <div key={String(p.id || idx)} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300">{String(p.title || p.channel || 'Post')}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                    {String(p.status || 'draft')}
                  </span>
                </div>
                <p className="text-slate-300 line-clamp-2">{String(p.caption || p.copy || '')}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Steward Test Board Dry-Run Receipts ({testBoardPosts.length})
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {testBoardPosts.map((tb, idx) => (
              <div key={String(tb.id || idx)} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300">
                    {String(tb.channel || 'Social')} · {String(tb.title || '')}
                  </span>
                  <span className="text-[11px] text-slate-500">{String(tb.publishedAt || '').slice(0, 16)}</span>
                </div>
                <p className="text-slate-300 line-clamp-2">{String(tb.caption || '')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

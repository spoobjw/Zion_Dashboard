import { useRequest } from '../useRequest.ts';
import { StatusMessage, ModuleHeader } from '../components/ui.tsx';
import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Plus,
  FileSpreadsheet,
  CheckCircle,
  Gavel,
  Calendar,
} from 'lucide-react';

interface BoardProject {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  owner: string;
  budget_allocated: number;
  budget_spent: number;
  target_date: string;
  description: string;
  next_milestone: string;
}

interface BoardMotion {
  id: string;
  motion_number: string;
  motion_text: string;
  moved_by: string;
  seconded_by: string;
  vote_result: string;
  action_required: string;
  project_title?: string;
}

export function BoardAdminModule() {
  const { request, error, busy } = useRequest();
  const [projects, setProjects] = useState<BoardProject[]>([]);
  const [motions, setMotions] = useState<BoardMotion[]>([]);
  const [packetMarkdown, setPacketMarkdown] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewMotion, setShowNewMotion] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Facilities');
  const [status, setStatus] = useState('In Progress');
  const [priority, setPriority] = useState('Normal');
  const [owner, setOwner] = useState('');
  const [budgetAllocated, setBudgetAllocated] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [nextMilestone, setNextMilestone] = useState('');
  const [description, setDescription] = useState('');

  const [motionNumber, setMotionNumber] = useState('2026-11-M1');
  const [motionText, setMotionText] = useState('');
  const [movedBy, setMovedBy] = useState('');
  const [secondedBy, setSecondedBy] = useState('');
  const [voteResult, setVoteResult] = useState('Passed Unanimously');

  const load = async () => {
    const res = await request('/api/board/overview');
    if (!res) return;
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects || []);
      setMotions(data.motions || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const response = await request('/api/board/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        status,
        priority,
        owner,
        budget_allocated: budgetAllocated,
        target_date: targetDate,
        next_milestone: nextMilestone,
        description,
      }),
    });
    if (!response) return;
    setTitle('');
    setOwner('');
    setDescription('');
    setNextMilestone('');
    setShowNewProject(false);
    load();
  };

  const handleUpdateProjectStatus = async (proj: BoardProject, nextStatus: string) => {
    const response = await request('/api/board/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proj, status: nextStatus }),
    });
    if (!response) return;
    load();
  };

  const handleSaveMotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motionText.trim()) return;
    const response = await request('/api/board/motion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        motion_number: motionNumber,
        motion_text: motionText,
        moved_by: movedBy,
        seconded_by: secondedBy,
        vote_result: voteResult,
      }),
    });
    if (!response) return;
    setMotionText('');
    setShowNewMotion(false);
    load();
  };

  const handleGeneratePacket = async () => {
    const res = await request('/api/board/generate-packet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_date: new Date().toISOString().slice(0, 10),
      }),
    });
    if (!res) return;
    if (res.ok) {
      const data = await res.json();
      setPacketMarkdown(data.packetMarkdown || '');
    }
  };

  const columns = ['Proposed', 'Approved', 'In Progress', 'Blocked', 'Completed'];

  return (
    <div className="space-y-6">
      <StatusMessage error={error} busy={busy} />
      <ModuleHeader title="Board" subtitle={<>
            Track trustees/deacons projects, formal board motions, and generate monthly Board Meeting packets
          </>}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGeneratePacket}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Generate Monthly Board Packet
          </button>
          <button
            onClick={() => setShowNewMotion(!showNewMotion)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            <Gavel className="w-4 h-4 text-amber-400" />
            Record Motion
          </button>
          <button
            onClick={() => setShowNewProject(!showNewProject)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            New Board Project
          </button>
        </div>
      </ModuleHeader>

      {showNewProject && (
        <form onSubmit={handleSaveProject} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-amber-400">Create Board Project</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              placeholder="Project Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Facilities">Facilities & Grounds</option>
              <option value="Finance/Stewardship">Finance / Stewardship</option>
              <option value="Staffing">Staffing & Compensation</option>
              <option value="Policy/Constitution">Constitution & Policy</option>
              <option value="Outreach">Sterling & NJC Outreach</option>
              <option value="Worship">Worship & A/V Tech</option>
            </select>
            <input
              placeholder="Board Owner (e.g. Dale Miller)"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Allocated Budget ($)"
              value={budgetAllocated || ''}
              onChange={(e) => setBudgetAllocated(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Next Milestone"
              value={nextMilestone}
              onChange={(e) => setNextMilestone(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Scope & notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm"
          />
          <button disabled={busy} type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
            Save Board Project
          </button>
        </form>
      )}

      {showNewMotion && (
        <form onSubmit={handleSaveMotion} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-amber-400">Record Formal Board Motion</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              placeholder="Motion # (e.g. 2026-11-M1)"
              value={motionNumber}
              onChange={(e) => setMotionNumber(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Moved By"
              value={movedBy}
              onChange={(e) => setMovedBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Seconded By"
              value={secondedBy}
              onChange={(e) => setSecondedBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={voteResult}
              onChange={(e) => setVoteResult(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Passed Unanimously">Passed Unanimously</option>
              <option value="Passed">Passed</option>
              <option value="Tabled">Tabled</option>
              <option value="Defeated">Defeated</option>
            </select>
          </div>
          <textarea
            rows={2}
            placeholder="Exact text of motion..."
            value={motionText}
            onChange={(e) => setMotionText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm"
            required
          />
          <button disabled={busy} type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
            Save Motion
          </button>
        </form>
      )}

      {packetMarkdown && (
        <div className="bg-slate-900 border border-sky-700/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-sky-300">Generated Board Meeting Packet (Auto-Synced with Finances & Projects)</h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(packetMarkdown);
              }}
              className="px-3 py-1 rounded bg-sky-500 text-slate-950 font-bold text-xs"
            >
              Copy Markdown Packet
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto">
            {packetMarkdown}
          </pre>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {columns.map((col) => {
          const items = projects.filter((p) => p.status === col);
          return (
            <div key={col} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{col}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-bold">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {items.map((proj) => (
                  <div key={proj.id} className="bg-slate-950 border border-slate-800/90 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                        {proj.category}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          proj.priority === 'High'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {proj.priority}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white leading-snug">{proj.title}</h4>
                    {proj.description && <p className="text-[11px] text-slate-400">{proj.description}</p>}
                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-900">
                      <div>Owner: <span className="text-slate-200">{proj.owner || 'Unassigned'}</span></div>
                      {proj.budget_allocated > 0 && (
                        <div>
                          Budget: <span className="text-emerald-400">${proj.budget_spent.toLocaleString()}</span> / ${proj.budget_allocated.toLocaleString()}
                        </div>
                      )}
                      {proj.target_date && (
                        <div className="flex items-center gap-1 text-amber-300/90">
                          <Calendar className="w-3 h-3" /> Due {proj.target_date}
                        </div>
                      )}
                    </div>
                    <select
                      value={proj.status}
                      onChange={(e) => handleUpdateProjectStatus(proj, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300"
                    >
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          Move to: {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Motions Register */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Gavel className="w-4 h-4 text-amber-400" />
          Board Motions & Official Action Register
        </h3>
        <div className="space-y-2">
          {motions.map((m) => (
            <div
              key={m.id}
              className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400">{m.motion_number}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[11px]">
                    <CheckCircle className="w-3 h-3" /> {m.vote_result}
                  </span>
                </div>
                <p className="text-slate-200">{m.motion_text}</p>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                Moved: {m.moved_by || '-'} · 2nd: {m.seconded_by || '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

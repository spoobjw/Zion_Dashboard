import { useRequest } from '../useRequest.ts';
import { StatusMessage, ModuleHeader } from '../components/ui.tsx';
import React, { useEffect, useState } from 'react';
import {
  Flame,
  Check,
  Sparkles,
  Plus,
  EyeOff,
  Eye,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Award,
} from 'lucide-react';

interface PrayerRequest {
  id: string;
  circle: 'Congregation' | 'Students' | 'Family & Friends' | 'Personal & Formation';
  person_name: string;
  linked_member_id: string | null;
  privacy_mode: 'full' | 'initials';
  subgroup: string;
  title: string;
  details: string;
  scripture_anchor: string;
  urgency: 'Urgent' | 'High' | 'Regular' | 'Praise';
  status: 'Active' | 'Answered' | 'Archived';
  prayer_count: number;
  last_prayed_at: string;
  answered_at: string;
  answer_testimony: string;
}

const CIRCLES: Array<PrayerRequest['circle']> = [
  'Congregation',
  'Students',
  'Family & Friends',
  'Personal & Formation',
];

function formatPrivacyName(name: string, mode: 'full' | 'initials', maskStudents: boolean): string {
  if (!maskStudents && mode === 'full') return name;
  return name
    .split(/\s+/)
    .map((part) => (part.startsWith('(') ? part : `${part[0] || ''}.`))
    .join(' ');
}

export function PrayerAppModule() {
  const { request, error, busy } = useRequest();
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<string>('ALL');
  const [focusDeckMode, setFocusDeckMode] = useState<boolean>(true);
  const [deckIndex, setDeckIndex] = useState<number>(0);
  const [maskStudentNames, setMaskStudentNames] = useState<boolean>(false);
  const [journalNote, setJournalNote] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const [newCircle, setNewCircle] = useState<PrayerRequest['circle']>('Congregation');
  const [newPerson, setNewPerson] = useState('');
  const [newSubgroup, setNewSubgroup] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [newScripture, setNewScripture] = useState('Matthew 5:13–16');
  const [newUrgency, setNewUrgency] = useState<PrayerRequest['urgency']>('Regular');

  const load = async () => {
    const res = await request('/api/prayer/overview');
    if (!res) return;
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeDeck = requests.filter(
    (r) => r.status === 'Active' && (selectedCircle === 'ALL' || r.circle === selectedCircle)
  );
  const answeredList = requests.filter((r) => r.status === 'Answered');
  const currentCard = activeDeck[deckIndex] || activeDeck[0] || null;

  const handlePrayNow = async (reqItem: PrayerRequest) => {
    const response = await request('/api/prayer/pray-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reqItem.id, journal_note: journalNote }),
    });
    if (!response) return;
    setJournalNote('');
    await load();
    if (deckIndex < activeDeck.length - 1) {
      setDeckIndex(deckIndex + 1);
    } else {
      setDeckIndex(0);
    }
  };

  const handleMarkAnswered = async (reqItem: PrayerRequest) => {
    const testimony = window.prompt('How did God answer this prayer?', reqItem.answer_testimony || 'Thankful for faithfulness and breakthrough.');
    if (testimony === null) return;
    const response = await request('/api/prayer/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reqItem,
        status: 'Answered',
        answer_testimony: testimony,
      }),
    });
    if (!response) return;
    load();
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerson.trim() || !newTitle.trim()) return;
    const response = await request('/api/prayer/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circle: newCircle,
        person_name: newPerson,
        privacy_mode: newCircle === 'Students' ? 'initials' : 'full',
        subgroup: newSubgroup,
        title: newTitle,
        details: newDetails,
        scripture_anchor: newScripture,
        urgency: newUrgency,
        status: 'Active',
      }),
    });
    if (!response) return;
    setNewPerson('');
    setNewSubgroup('');
    setNewTitle('');
    setNewDetails('');
    setShowAddModal(false);
    load();
  };

  return (
    <div className="space-y-6">
      <StatusMessage error={error} busy={busy} />
      {/* Header */}
      <ModuleHeader title="Prayer" subtitle={<>
            Smart rotation queue by urgency and longest time since last prayed
          </>}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMaskStudentNames(!maskStudentNames)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            {maskStudentNames ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            {maskStudentNames ? 'Initials Mode ON' : 'Full Names'}
          </button>
          <button
            onClick={() => setFocusDeckMode(!focusDeckMode)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {focusDeckMode ? 'Switch to Grid View' : 'Android Focus Deck'}
          </button>
          <button
            onClick={() => setShowAddModal(!showAddModal)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
          >
            <Plus className="w-4 h-4" /> Add Prayer Need
          </button>
        </div>
      </ModuleHeader>

      {/* Circle Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['ALL', ...CIRCLES].map((c) => {
          const count = requests.filter((r) => r.status === 'Active' && (c === 'ALL' || r.circle === c)).length;
          return (
            <button
              key={c}
              onClick={() => {
                setSelectedCircle(c);
                setDeckIndex(0);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                selectedCircle === c
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{c === 'ALL' ? 'All Circles' : c}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-950/30 text-[11px]">{count}</span>
            </button>
          );
        })}
      </div>

      {showAddModal && (
        <form onSubmit={handleCreateRequest} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-amber-400">New Prayer Request / Intercession</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <select
              value={newCircle}
              onChange={(e) => setNewCircle(e.target.value as PrayerRequest['circle'])}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
            >
              {CIRCLES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              placeholder="Person or Group Name *"
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
              required
            />
            <input
              placeholder="Subgroup (e.g. 7th Grade, NJC, Hospital)"
              value={newSubgroup}
              onChange={(e) => setNewSubgroup(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
            />
            <select
              value={newUrgency}
              onChange={(e) => setNewUrgency(e.target.value as PrayerRequest['urgency'])}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
            >
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Regular">Regular</option>
              <option value="Praise">Praise</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <input
              placeholder="Prayer Focus Headline *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
              required
            />
            <input
              placeholder="Scripture Anchor (e.g. Psalm 121:1-2)"
              value={newScripture}
              onChange={(e) => setNewScripture(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Specific details, family context, or formation prompt..."
            value={newDetails}
            onChange={(e) => setNewDetails(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs"
          />
          <button disabled={busy} type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
            Save to Prayer Deck
          </button>
        </form>
      )}

      {/* ANDROID / DESKTOP FOCUS DECK MODE */}
      {focusDeckMode && currentCard && (
        <div className="max-w-2xl mx-auto bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between text-xs">
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold">
              {currentCard.circle} {currentCard.subgroup ? `· ${currentCard.subgroup}` : ''}
            </span>
            <span className="text-slate-400">
              Card {deckIndex + 1} of {activeDeck.length} · Prayed {currentCard.prayer_count}x
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-bold uppercase ${
                  currentCard.urgency === 'Urgent'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-sky-500/20 text-sky-300'
                }`}
              >
                {currentCard.urgency}
              </span>
              <h3 className="text-2xl font-bold text-white">
                {formatPrivacyName(currentCard.person_name, currentCard.privacy_mode, maskStudentNames)}
              </h3>
            </div>
            <p className="text-base font-semibold text-amber-200">{currentCard.title}</p>
            {currentCard.details && (
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                {currentCard.details}
              </p>
            )}
          </div>

          {currentCard.scripture_anchor && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-800/50 rounded-xl px-4 py-2.5">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>
                <strong>Scripture to Pray Over {formatPrivacyName(currentCard.person_name, currentCard.privacy_mode, maskStudentNames)}:</strong>{' '}
                {currentCard.scripture_anchor}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <input
              value={journalNote}
              onChange={(e) => setJournalNote(e.target.value)}
              placeholder="Optional whispered prayer or voice-to-text reflection..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200"
            />

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                onClick={() => setDeckIndex((prev) => (prev > 0 ? prev - 1 : activeDeck.length - 1))}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => handlePrayNow(currentCard)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg"
              >
                <Check className="w-5 h-5" />
                Amen — Prayed Now (Next Card)
              </button>

              <button
                onClick={() => handleMarkAnswered(currentCard)}
                className="px-3.5 py-3.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold"
                title="Record Answered Prayer Testimony"
              >
                Answered
              </button>

              <button
                onClick={() => setDeckIndex((prev) => (prev < activeDeck.length - 1 ? prev + 1 : 0))}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALL ACTIVE PRAYER CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeDeck.map((r) => (
          <div key={r.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-400 font-semibold">{r.circle}</span>
                <span className="text-slate-500">Prayed {r.prayer_count}x</span>
              </div>
              <h4 className="font-bold text-white text-sm">
                {formatPrivacyName(r.person_name, r.privacy_mode, maskStudentNames)}
              </h4>
              <p className="text-xs font-medium text-slate-200">{r.title}</p>
              {r.details && <p className="text-xs text-slate-400 line-clamp-2">{r.details}</p>}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-[11px] text-emerald-400">{r.scripture_anchor}</span>
              <button
                onClick={() => handlePrayNow(r)}
                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold"
              >
                Prayed +1
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Answered Prayers Testimony Log */}
      {answeredList.length > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
            <Award className="w-4 h-4" /> Answered Prayers & Ebenezer Testimonies ({answeredList.length})
          </h3>
          {answeredList.map((a) => (
            <div key={a.id} className="bg-slate-950/80 border border-emerald-900/50 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <strong className="text-white">{a.person_name}:</strong>{' '}
                <span className="text-emerald-300">{a.title}</span> —{' '}
                <span className="text-slate-300">{a.answer_testimony}</span>
              </div>
              <span className="text-slate-500 text-[11px]">{a.answered_at.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

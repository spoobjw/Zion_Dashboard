import { useRequest } from '../useRequest.ts';
import { StatusMessage, ModuleHeader } from '../components/ui.tsx';
import React, { useEffect, useState } from 'react';
import {
  Users,
  Phone,
  MessageSquare,
  Mail,
  HeartHandshake,
  Upload,
  Plus,
  AlertCircle,
  Search,
  Home,
} from 'lucide-react';

interface Household {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  anniversary: string;
  notes: string;
}

interface Member {
  id: string;
  household_id: string | null;
  household_name?: string;
  first_name: string;
  last_name: string;
  status: string;
  role_in_family: string;
  phone: string;
  email: string;
  birthday: string;
  joined_date: string;
  ministries: string;
  care_flag: number;
  care_notes: string;
}

interface CareLog {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  contact_type: string;
  summary: string;
  follow_up_date: string;
  created_at: string;
}

export function MembershipModule() {
  const { request, error, busy } = useRequest();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [careLogs, setCareLogs] = useState<CareLog[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddMember, setShowAddMember] = useState(false);
  const [careTarget, setCareTarget] = useState<Member | null>(null);
  const [importStatus, setImportStatus] = useState('');

  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newStatus, setNewStatus] = useState('Member');
  const [newHouseholdId, setNewHouseholdId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newBirthday, setNewBirthday] = useState('');
  const [newCareFlag, setNewCareFlag] = useState(false);
  const [newCareNotes, setNewCareNotes] = useState('');

  const [careType, setCareType] = useState('Visit');
  const [careSummary, setCareSummary] = useState('');
  const [careFollowUp, setCareFollowUp] = useState('');
  const [careAddPrayer, setCareAddPrayer] = useState(true);

  const load = async () => {
    const res = await request('/api/membership/overview');
    if (!res) return;
    if (res.ok) {
      const data = await res.json();
      setHouseholds(data.households || []);
      setMembers(data.members || []);
      setCareLogs(data.careLogs || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirst.trim() || !newLast.trim()) return;
    const response = await request('/api/membership/member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: newFirst,
        last_name: newLast,
        status: newStatus,
        household_id: newHouseholdId || null,
        phone: newPhone,
        email: newEmail,
        birthday: newBirthday,
        care_flag: newCareFlag ? 1 : 0,
        care_notes: newCareNotes,
        sync_to_prayer: newCareFlag,
      }),
    });
    if (!response) return;
    setNewFirst('');
    setNewLast('');
    setNewPhone('');
    setNewEmail('');
    setNewBirthday('');
    setNewCareFlag(false);
    setNewCareNotes('');
    setShowAddMember(false);
    load();
  };

  const handleSaveCareLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!careTarget || !careSummary.trim()) return;
    const response = await request('/api/membership/care-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: careTarget.id,
        contact_type: careType,
        summary: careSummary,
        follow_up_date: careFollowUp,
        add_to_prayer: careAddPrayer,
      }),
    });
    if (!response) return;
    setCareSummary('');
    setCareFollowUp('');
    setCareTarget(null);
    load();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || '').split(',')[1] || '';
      const res = await request('/api/membership/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, base64Data: base64 }),
      });
      if (!res) return;
      const json = await res.json();
      if (res.ok) {
        setImportStatus(`Imported ${json.imported} members from ${file.name}`);
        load();
      } else {
        setImportStatus(`Error: ${json.error}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const filtered = members.filter((m) => {
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter || (statusFilter === 'CARE' && m.care_flag === 1);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      (m.household_name || '').toLowerCase().includes(q) ||
      (m.phone || '').includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <StatusMessage error={error} busy={busy} />
      <ModuleHeader title="People & care" subtitle={<>
            {members.length} people across {households.length} households in Sterling & NJC
          </>}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700">
            <Upload className="w-4 h-4 text-sky-400" />
            Import CSV/XLSX
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Add Person
          </button>
        </div>
      </ModuleHeader>

      {importStatus && (
        <div className="bg-sky-950/60 border border-sky-700/60 text-sky-200 text-xs px-4 py-2.5 rounded-lg">
          {importStatus}
        </div>
      )}

      {showAddMember && (
        <form onSubmit={handleSaveMember} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-amber-400">New Congregation Member / Student</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              placeholder="First Name *"
              value={newFirst}
              onChange={(e) => setNewFirst(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="Last Name *"
              value={newLast}
              onChange={(e) => setNewLast(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Member">Member</option>
              <option value="Regular Attender">Regular Attender</option>
              <option value="NJC Student">NJC Student</option>
              <option value="Youth">Youth</option>
              <option value="Visitor">Visitor</option>
            </select>
            <select
              value={newHouseholdId}
              onChange={(e) => setNewHouseholdId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Select Household --</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Phone (e.g. 970-522-...)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-amber-300">
              <input
                type="checkbox"
                checked={newCareFlag}
                onChange={(e) => setNewCareFlag(e.target.checked)}
                className="rounded"
              />
              Flag for Pastoral Care & Auto-Add to Prayer App
            </label>
            <input
              placeholder="Pastoral care note / hospital / family context..."
              value={newCareNotes}
              onChange={(e) => setNewCareNotes(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm"
            />
            <button disabled={busy} type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
              Save Member
            </button>
          </div>
        </form>
      )}

      {careTarget && (
        <form onSubmit={handleSaveCareLog} className="bg-amber-950/30 border border-amber-700/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-300">
              Log Pastoral Care — {careTarget.first_name} {careTarget.last_name}
            </h3>
            <button type="button" onClick={() => setCareTarget(null)} className="text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={careType}
              onChange={(e) => setCareType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Visit">Home / Farm Visit</option>
              <option value="Hospital">Hospital / Medical</option>
              <option value="Call">Phone Call</option>
              <option value="Text">Text Check-In</option>
              <option value="Counseling">Pastoral Counseling</option>
            </select>
            <input
              type="date"
              value={careFollowUp}
              onChange={(e) => setCareFollowUp(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-xs text-amber-200">
              <input
                type="checkbox"
                checked={careAddPrayer}
                onChange={(e) => setCareAddPrayer(e.target.checked)}
              />
              Sync directly to Congregation Prayer Deck
            </label>
          </div>
          <textarea
            rows={2}
            placeholder="Summary of visit, scripture shared, or prayer need..."
            value={careSummary}
            onChange={(e) => setCareSummary(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm"
            required
          />
          <button disabled={busy} type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
            Record Care & Sync Prayer
          </button>
        </form>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            placeholder="Search by name, household, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['ALL', 'CARE', 'Member', 'NJC Student', 'Regular Attender'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {st === 'CARE' ? 'Care Flags' : st}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
              m.care_flag
                ? 'bg-rose-950/20 border-rose-800/70'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    {m.first_name} {m.last_name}
                    {m.care_flag === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        <AlertCircle className="w-3 h-3" /> Care Flag
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Home className="w-3.5 h-3.5 text-slate-500" />
                    {m.household_name || 'Individual'} · <span className="text-amber-400">{m.status}</span>
                  </p>
                </div>
                {m.birthday && (
                  <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                    B-Day: {m.birthday}
                  </span>
                )}
              </div>
              {m.care_notes && (
                <p className="mt-2 text-xs text-rose-200 bg-rose-950/40 border border-rose-900/50 rounded-lg px-3 py-1.5">
                  {m.care_notes}
                </p>
              )}
            </div>

            {/* Android One-Tap Quick Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
              <div className="flex items-center gap-1.5">
                {m.phone && (
                  <>
                    <a
                      href={`tel:${m.phone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium border border-emerald-500/30"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call
                    </a>
                    <a
                      href={`sms:${m.phone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-medium border border-sky-500/30"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Text
                    </a>
                  </>
                )}
                {m.email && (
                  <a
                    href={`mailto:${m.email}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </a>
                )}
              </div>
              <button
                onClick={() => setCareTarget(m)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium border border-amber-500/30"
              >
                <HeartHandshake className="w-3.5 h-3.5" /> Log Care / Pray
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-200 mb-3">Recent Pastoral Care & Visitation Log</h3>
        <div className="space-y-2">
          {careLogs.map((log) => (
            <div key={log.id} className="text-xs bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-amber-400">
                  {log.first_name} {log.last_name}
                </span>{' '}
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] mx-1">
                  {log.contact_type}
                </span>
                <span className="text-slate-300">{log.summary}</span>
              </div>
              <div className="text-slate-500 whitespace-nowrap">
                {log.follow_up_date ? `Follow-up: ${log.follow_up_date}` : log.created_at.slice(0, 10)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

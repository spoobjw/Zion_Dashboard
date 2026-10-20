import React, { useEffect, useState } from 'react';
import {
  Users,
  DollarSign,
  ClipboardList,
  BookOpen,
  Library,
  Share2,
  Flame,

  MoreHorizontal,
  Settings,
} from 'lucide-react';
import { MembershipModule } from './modules/MembershipModule.tsx';
import { FinancesModule } from './modules/FinancesModule.tsx';
import { BoardAdminModule } from './modules/BoardAdminModule.tsx';
import { SermonPrepModule } from './modules/SermonPrepModule.tsx';
import { LogosWorkbenchModule } from './modules/LogosWorkbenchModule.tsx';
import { StewardHubModule } from './modules/StewardHubModule.tsx';
import { PrayerAppModule } from './modules/PrayerAppModule.tsx';

import { Disclosure } from './components/ui.tsx';
const modules = [
  { key: 'sermon', label: 'Sermon', group: 'Ministry', icon: BookOpen, component: SermonPrepModule },
  { key: 'logos', label: 'Study', group: 'Ministry', icon: Library, component: LogosWorkbenchModule },
  { key: 'prayer', label: 'Prayer', group: 'Ministry', icon: Flame, component: PrayerAppModule },
  { key: 'membership', label: 'People', group: 'Administration', icon: Users, component: MembershipModule },
  { key: 'finances', label: 'Finance', group: 'Administration', icon: DollarSign, component: FinancesModule },
  { key: 'board', label: 'Board', group: 'Administration', icon: ClipboardList, component: BoardAdminModule },
  { key: 'steward', label: 'Steward', group: 'Communications', icon: Share2, component: StewardHubModule },
] as const;
export type ModuleKey = typeof modules[number]['key'];
export default function App() {
  const [activeTab, setActiveTab] = useState<ModuleKey>('sermon');
  const [visited, setVisited] = useState<Set<ModuleKey>>(() => new Set(['sermon']));
  const [showSettings, setShowSettings] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [mobileUrl, setMobileUrl] = useState('');
  const [cacheMessage, setCacheMessage] = useState('');
  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => {
      setMobileUrl(data?.network?.tailscale?.[0] || data?.network?.lan?.[0] || '');
    }).catch(() => undefined);
  }, []);
  const selectModule = (key: ModuleKey) => {
    setVisited(previous => new Set([...previous, key])); setActiveTab(key);
    setShowMore(false); setShowSettings(false);
  };
  const navButton = (item: typeof modules[number]) => <button key={item.key} type="button"
    aria-current={!showSettings && activeTab === item.key ? 'page' : undefined}
    onClick={() => selectModule(item.key)} className="nav-item"><item.icon size={19} aria-hidden="true" />{item.label}</button>;
  const clearCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('zion-')).map(key => caches.delete(key)));
      }
      setCacheMessage('Dashboard offline cache cleared.');
    } catch { setCacheMessage('Could not clear the cache. Please try again.'); }
  };
  return <div className="dashboard-shell">
    <header className="app-header"><div><h1>Zion</h1><span>Ministry workspace</span></div>
      <button type="button" className="settings-button" aria-expanded={showSettings} onClick={() => { setShowSettings(!showSettings); setShowMore(false); }}><Settings size={18} />Help & settings</button>
    </header>
    <aside className="sidebar"><nav aria-label="Modules">{['Ministry', 'Administration', 'Communications'].map(group =>
      <div key={group} className="nav-group"><p>{group}</p>{modules.filter(item => item.group === group).map(navButton)}</div>
    )}</nav><p className="sidebar-note">Zion Congregational Church<br />Sterling, Colorado</p></aside>
    <main className="workspace">
      {showSettings && <section aria-label="Help and settings" className="settings-panel"><h2>Help & settings</h2>
        <Disclosure title="Connect another device"><p>Open the dashboard through your private connection. Remote devices require the access credentials configured on the server.</p>{mobileUrl && <p className="break-all">{mobileUrl}</p>}</Disclosure>
        <Disclosure title="Privacy & offline storage"><p>Pastoral and financial records are fetched from the server and are not saved for offline use. Drafts stay in memory while you switch modules; save before reloading or closing this page.</p><button type="button" className="secondary-action" onClick={clearCache}>Clear dashboard cache</button><p role="status">{cacheMessage}</p></Disclosure>
      <Disclosure title="AI workflow playbook">
      {showSettings && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">
                Multi-AI Workflow Routing (Cursor Pro+ · Claude Pro · ChatGPT/Codex Plus · Gemini Plus · Grok)
              </span>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 pt-1">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="font-bold text-white">Cursor Pro+</div>
                <p className="text-slate-400 mt-0.5">
                  Full-stack UI/SQLite wiring, Playwright Logos automation, and zero-fluff `.cursorrules` diffs.
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="font-bold text-amber-300">Claude Pro</div>
                <p className="text-slate-400 mt-0.5">
                  `/sermon-prep` execution, 6-Step Refinement Wizard, Keller Gospel-Turn &amp; `build_docs.py` Preachable `.docx`.
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="font-bold text-emerald-300">ChatGPT / Codex Plus</div>
                <p className="text-slate-400 mt-0.5">
                  Steward Bot (`Social_Media_Bot`), `CAMPAIGN-BLOCK.md` contract sync, and `node --test` suites.
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="font-bold text-sky-300">Gemini Plus</div>
                <p className="text-slate-400 mt-0.5">
                  Scanned PDF Vision OCR for Monthly Treasurer Statements &amp; Annual Congregational Reports.
                </p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <div className="font-bold text-purple-300">Grok Bot</div>
                <p className="text-slate-400 mt-0.5">
                  Stress-testing Facebook/Instagram hooks, local cultural angles, and counter-resistance checks.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      </Disclosure>
      </section>}
      {modules.filter(item => visited.has(item.key)).map(item => <section key={item.key} hidden={showSettings || activeTab !== item.key} aria-label={item.label} className="module-view"><item.component /></section>)}
    </main>
    {showMore && <div className="mobile-more"><nav aria-label="More modules">{modules.slice(3).map(navButton)}</nav></div>}
    <nav className="mobile-nav" aria-label="Quick navigation">{modules.slice(0, 3).map(navButton)}<button type="button" className="nav-item" aria-expanded={showMore} aria-current={!showSettings && modules.slice(3).some(item => item.key === activeTab) ? 'page' : undefined} onClick={() => setShowMore(!showMore)}><MoreHorizontal size={19} />More</button></nav>
  </div>;
}

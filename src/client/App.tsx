import React, { useEffect, useState } from 'react';
import {
  Users,
  DollarSign,
  ClipboardList,
  BookOpen,
  Library,
  Share2,
  Flame,
  Smartphone,
  Cpu,
} from 'lucide-react';
import { MembershipModule } from './modules/MembershipModule.tsx';
import { FinancesModule } from './modules/FinancesModule.tsx';
import { BoardAdminModule } from './modules/BoardAdminModule.tsx';
import { SermonPrepModule } from './modules/SermonPrepModule.tsx';
import { LogosWorkbenchModule } from './modules/LogosWorkbenchModule.tsx';
import { StewardHubModule } from './modules/StewardHubModule.tsx';
import { PrayerAppModule } from './modules/PrayerAppModule.tsx';

export type ModuleKey =
  | 'prayer'
  | 'sermon'
  | 'logos'
  | 'membership'
  | 'finances'
  | 'board'
  | 'steward';

export default function App() {
  const [activeTab, setActiveTab] = useState<ModuleKey>('sermon');
  const [health, setHealth] = useState<{
    port: number;
    network: { lan: string[]; tailscale: string[] };
  } | null>(null);
  const [showAiGuide, setShowAiGuide] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => undefined);
  }, []);

  const navItems: Array<{ key: ModuleKey; label: string; shortLabel: string; icon: React.ReactNode }> = [
    { key: 'sermon', label: '4. Sermon Prep & Wizard', shortLabel: 'Sermon', icon: <BookOpen className="w-4 h-4" /> },
    { key: 'logos', label: '5. Logos Bible Study', shortLabel: 'Logos', icon: <Library className="w-4 h-4" /> },
    { key: 'prayer', label: '7. Daily Prayer App', shortLabel: 'Prayer', icon: <Flame className="w-4 h-4" /> },
    { key: 'membership', label: '1. Membership & Care', shortLabel: 'People', icon: <Users className="w-4 h-4" /> },
    { key: 'finances', label: '2. Church Finances (PDF)', shortLabel: 'Finance', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'board', label: '3. Board Administration', shortLabel: 'Board', icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'steward', label: '6. Steward Social Bot', shortLabel: 'Steward', icon: <Share2 className="w-4 h-4" /> },
  ];

  const renderActiveModule = (tab: ModuleKey) => {
    switch (tab) {
      case 'membership':
        return <MembershipModule />;
      case 'finances':
        return <FinancesModule />;
      case 'board':
        return <BoardAdminModule />;
      case 'sermon':
        return <SermonPrepModule />;
      case 'logos':
        return <LogosWorkbenchModule />;
      case 'steward':
        return <StewardHubModule />;
      case 'prayer':
        return <PrayerAppModule />;
      default: {
        const _exhaustiveCheck: never = tab;
        return _exhaustiveCheck;
      }
    }
  };

  const mobileUrl =
    health?.network?.tailscale?.[0] || health?.network?.lan?.[0] || 'http://127.0.0.1:3400';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 lg:pb-8">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
              Z
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
                Zion Congregational Church Dashboard
              </h1>
              <p className="text-xs text-slate-400">
                Sterling, CO · Pastoral Ministry, Administration, Sermon Prep &amp; Prayer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAiGuide(!showAiGuide)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-amber-300"
            >
              <Cpu className="w-3.5 h-3.5" /> Multi-AI Stack Playbook
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-sky-300">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android PWA: {mobileUrl}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Multi-AI Subscription Playbook Drawer */}
      {showAiGuide && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">
                Multi-AI Workflow Routing (Cursor Pro+ · Claude Pro · ChatGPT/Codex Plus · Gemini Plus · Grok)
              </span>
              <button onClick={() => setShowAiGuide(false)} className="text-slate-400 hover:text-white">
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

      {/* Desktop Module Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 pt-4 hidden lg:block">
        <nav className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeTab === item.key
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Module Viewport */}
      <main className="max-w-7xl mx-auto px-4 pt-4">{renderActiveModule(activeTab)}</main>

      {/* Android Thumb-Friendly Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex items-center justify-around py-1.5 px-1 lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium ${
              activeTab === item.key ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            {item.icon}
            <span className="mt-0.5">{item.shortLabel}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

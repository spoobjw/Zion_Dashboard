import { useRequest } from '../useRequest.ts';
import { StatusMessage, Disclosure, ModuleHeader } from '../components/ui.tsx';
import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  FileUp,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';

interface LineItem {
  id?: string;
  fund_name: string;
  section: 'Income' | 'Expense' | 'FundBalance';
  category: string;
  account_code: string;
  line_name: string;
  monthly_actual: number;
  monthly_budget: number;
  ytd_actual: number;
  annual_budget: number;
  prior_year_actual: number;
}

interface FinanceDoc {
  id: string;
  filename: string;
  stored_path: string;
  period_type: 'monthly' | 'annual';
  statement_date: string;
  status: 'pending_review' | 'verified';
  total_income: number;
  total_expenses: number;
  net_balance: number;
  general_fund_balance: number;
  designated_funds_balance: number;
  ocr_engine: string;
  notes: string;
  computed_income: number;
  computed_expenses: number;
  has_math_discrepancy: boolean;
  line_items: LineItem[];
}

export function FinancesModule() {
  const { request, error, busy } = useRequest();
  const [documents, setDocuments] = useState<FinanceDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [ocrEngine, setOcrEngine] = useState<'gemini-2.5-pro-vision' | 'claude-sonnet-vision'>('gemini-2.5-pro-vision');
  const [periodType, setPeriodType] = useState<'monthly' | 'annual'>('monthly');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 7));
  const [uploading, setUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [editDoc, setEditDoc] = useState<FinanceDoc | null>(null);

  const load = async (selectId?: string) => {
    const res = await request('/api/finances/overview');
    if (!res) return;
    if (res.ok) {
      const data = await res.json();
      const docs: FinanceDoc[] = data.documents || [];
      setDocuments(docs);
      const targetId = selectId || selectedId || docs[0]?.id || '';
      setSelectedId(targetId);
      const found = docs.find((d) => d.id === targetId) || null;
      setEditDoc(found ? structuredClone(found) : null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelectDoc = (id: string) => {
    setSelectedId(id);
    const found = documents.find((d) => d.id === id) || null;
    setEditDoc(found ? structuredClone(found) : null);
    setSaveMessage('');
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSaveMessage('Running Vision OCR table extraction on scanned PDF...');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Pdf = String(reader.result || '').split(',')[1] || '';
      const res = await request('/api/finances/upload-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          base64Pdf,
          period_type: periodType,
          statement_date: statementDate,
          ocr_engine: ocrEngine,
        }),
      });
      if (!res) { setUploading(false); return; }
      const json = await res.json();
      setUploading(false);
      if (res.ok) {
        setSaveMessage(`Scanned PDF "${file.name}" extracted via ${ocrEngine}. Verify line items below.`);
        await load(json.id);
      } else {
        setSaveMessage(`Error: ${json.error}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveVerification = async (status: 'pending_review' | 'verified') => {
    if (!editDoc) return;
    const res = await request('/api/finances/verify-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editDoc,
        status,
      }),
    });
    if (!res) return;
    if (res.ok) {
      setSaveMessage(status === 'verified' ? 'Statement verified and committed to SQLite ledger.' : 'Draft changes saved.');
      load(editDoc.id);
    }
  };

  const updateLineItem = (idx: number, field: keyof LineItem, value: string | number) => {
    if (!editDoc) return;
    const next = structuredClone(editDoc);
    const item = next.line_items[idx];
    if (!item) return;
    next.line_items[idx] = { ...item, [field]: value };

    const sumInc = next.line_items
      .filter((li) => li.section === 'Income')
      .reduce((acc, li) => acc + Number(li.monthly_actual || 0), 0);
    const sumExp = next.line_items
      .filter((li) => li.section === 'Expense')
      .reduce((acc, li) => acc + Number(li.monthly_actual || 0), 0);
    next.computed_income = Number(sumInc.toFixed(2));
    next.computed_expenses = Number(sumExp.toFixed(2));
    next.has_math_discrepancy =
      Math.abs(sumInc - Number(next.total_income)) > 0.05 ||
      Math.abs(sumExp - Number(next.total_expenses)) > 0.05;
    setEditDoc(next);
  };

  const addLineItem = () => {
    if (!editDoc) return;
    const next = structuredClone(editDoc);
    next.line_items.push({
      fund_name: 'General Fund',
      section: 'Expense',
      category: 'Operating',
      account_code: '5500',
      line_name: 'New Line Item',
      monthly_actual: 0,
      monthly_budget: 0,
      ytd_actual: 0,
      annual_budget: 0,
      prior_year_actual: 0,
    });
    setEditDoc(next);
  };

  const removeLineItem = (idx: number) => {
    if (!editDoc) return;
    const next = structuredClone(editDoc);
    next.line_items.splice(idx, 1);
    setEditDoc(next);
  };

  return (
    <div className="space-y-6">
      <StatusMessage error={error} busy={busy} />
      {/* Top Upload & OCR Bar */}
      <ModuleHeader title="Finance" subtitle={<>
            Ingest scanned monthly treasurer PDFs & yearly annual reports with side-by-side math verification
          </>}>

        <Disclosure title="Upload a statement">
          <select
            aria-label="Statement period"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as 'monthly' | 'annual')}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200"
          >
            <option value="monthly">Monthly Budget Statement</option>
            <option value="annual">Yearly Annual Report</option>
          </select>
          <input
            type="text"
            aria-label="Statement date"
            value={statementDate}
            onChange={(e) => setStatementDate(e.target.value)}
            placeholder="YYYY-MM or YYYY"
            className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200"
          />
          <select
            aria-label="Extraction tool"
            value={ocrEngine}
            onChange={(e) => setOcrEngine(e.target.value as 'gemini-2.5-pro-vision' | 'claude-sonnet-vision')}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-amber-300"
          >
            <option value="gemini-2.5-pro-vision">Gemini 2.5 Pro Vision OCR</option>
            <option value="claude-sonnet-vision">Claude Sonnet Vision OCR</option>
          </select>
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold">
            <FileUp className="w-4 h-4" />
            {uploading ? 'Extracting PDF...' : 'Upload Scanned PDF'}
            <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={uploading} />
          </label>
        </Disclosure>
      </ModuleHeader>

      {saveMessage && (
        <div className="bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs px-4 py-2.5 rounded-lg">
          {saveMessage}
        </div>
      )}

      {/* Statement Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => handleSelectDoc(doc.id)}
            className={`px-3.5 py-2 rounded-xl border text-left transition flex items-center gap-2.5 whitespace-nowrap ${
              selectedId === doc.id
                ? 'bg-slate-800 border-amber-500 text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                {doc.statement_date} ({doc.period_type.toUpperCase()})
                {doc.status === 'verified' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{doc.filename}</div>
            </div>
          </button>
        ))}
      </div>

      {editDoc && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Statement Income</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">
                ${Number(editDoc.total_income).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Line Sum: ${Number(editDoc.computed_income).toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Statement Expenses</div>
              <div className="text-lg font-bold text-rose-400 mt-1">
                ${Number(editDoc.total_expenses).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Line Sum: ${Number(editDoc.computed_expenses).toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Net Margin</div>
              <div
                className={`text-lg font-bold mt-1 ${
                  editDoc.total_income - editDoc.total_expenses >= 0 ? 'text-sky-400' : 'text-rose-400'
                }`}
              >
                ${(Number(editDoc.total_income) - Number(editDoc.total_expenses)).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">{editDoc.period_type} net</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">General Fund Balance</div>
              <div className="text-lg font-bold text-white mt-1">
                ${Number(editDoc.general_fund_balance).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">Operating reserve</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Designated Funds</div>
              <div className="text-lg font-bold text-amber-400 mt-1">
                ${Number(editDoc.designated_funds_balance).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">Missions & Benevolence</div>
            </div>
          </div>

          {/* Math Discrepancy Alert Banner */}
          {editDoc.has_math_discrepancy && (
            <div className="bg-amber-950/50 border border-amber-600/70 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  <strong>Math Check Warning:</strong> Sum of extracted line items (Income ${editDoc.computed_income.toLocaleString()}, Expense ${editDoc.computed_expenses.toLocaleString()}) differs from header totals (Income ${Number(editDoc.total_income).toLocaleString()}, Expense ${Number(editDoc.total_expenses).toLocaleString()}). Review scanned rows below before marking Verified.
                </span>
              </div>
              <button
                onClick={() => {
                  setEditDoc({
                    ...editDoc,
                    total_income: editDoc.computed_income,
                    total_expenses: editDoc.computed_expenses,
                    net_balance: Number((editDoc.computed_income - editDoc.computed_expenses).toFixed(2)),
                    has_math_discrepancy: false,
                  });
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs whitespace-nowrap"
              >
                Sync Header to Line Sums
              </button>
            </div>
          )}

          {/* Side-by-Side Verification Studio */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Scanned PDF Preview & Statement Header Metadata */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Scanned Source Document</h3>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                  {editDoc.ocr_engine}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
                <div className="font-semibold text-slate-200 truncate">{editDoc.filename}</div>
                <object
                  data={`/api/finances/pdf/${editDoc.id}`}
                  type="application/pdf"
                  className="w-full h-56 rounded border border-slate-800 bg-slate-900"
                >
                  <div className="flex flex-col items-center justify-center h-56 text-center p-4 text-slate-400">
                    <FileText className="w-8 h-8 text-slate-600 mb-2" />
                    <p>Scanned PDF archived in SQLite metadata.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Upload a live PDF scan above to view embedded PDF pages side-by-side.
                    </p>
                  </div>
                </object>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <label className="space-y-1">
                  <span className="text-slate-400">Header Total Income</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editDoc.total_income}
                    onChange={(e) => setEditDoc({ ...editDoc, total_income: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Header Total Expenses</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editDoc.total_expenses}
                    onChange={(e) => setEditDoc({ ...editDoc, total_expenses: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">General Fund Bal</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editDoc.general_fund_balance}
                    onChange={(e) => setEditDoc({ ...editDoc, general_fund_balance: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Designated Bal</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editDoc.designated_funds_balance}
                    onChange={(e) => setEditDoc({ ...editDoc, designated_funds_balance: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
                  />
                </label>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="text-slate-400">Treasurer / Audit Notes</span>
                <textarea
                  rows={2}
                  value={editDoc.notes}
                  onChange={(e) => setEditDoc({ ...editDoc, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2"
                />
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleSaveVerification('verified')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" /> Verify & Commit
                </button>
                <button
                  onClick={() => handleSaveVerification('pending_review')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                >
                  <Save className="w-4 h-4" /> Save Draft
                </button>
              </div>
            </div>

            {/* Right: Editable Extracted Line Items & Budget Burn-Rate */}
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  Extracted Budget & Ledger Line Items ({editDoc.line_items.length})
                </h3>
                <button
                  onClick={addLineItem}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Line
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-2">Section</th>
                      <th className="py-2 px-2">Acct</th>
                      <th className="py-2 px-2">Line Item</th>
                      <th className="py-2 px-2 text-right">Actual</th>
                      <th className="py-2 px-2 text-right">Budget</th>
                      <th className="py-2 px-2 text-right">YTD</th>
                      <th className="py-2 px-2 text-right">Annual Bgt</th>
                      <th className="py-2 pl-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {editDoc.line_items.map((li, idx) => {
                      const pct = li.annual_budget > 0 ? Math.min(100, Math.round((li.ytd_actual / li.annual_budget) * 100)) : 0;
                      return (
                        <tr key={li.id || idx} className="hover:bg-slate-950/40">
                          <td className="py-2 pr-2">
                            <select
                              value={li.section}
                              onChange={(e) => updateLineItem(idx, 'section', e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[11px]"
                            >
                              <option value="Income">Income</option>
                              <option value="Expense">Expense</option>
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              value={li.account_code}
                              onChange={(e) => updateLineItem(idx, 'account_code', e.target.value)}
                              className="w-14 bg-slate-950 border border-slate-800 rounded px-1.5 py-1"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              value={li.line_name}
                              onChange={(e) => updateLineItem(idx, 'line_name', e.target.value)}
                              className="w-full min-w-[160px] bg-slate-950 border border-slate-800 rounded px-2 py-1"
                            />
                            <div className="w-full bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full ${li.section === 'Income' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={li.monthly_actual}
                              onChange={(e) => updateLineItem(idx, 'monthly_actual', Number(e.target.value))}
                              className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-right font-mono"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={li.monthly_budget}
                              onChange={(e) => updateLineItem(idx, 'monthly_budget', Number(e.target.value))}
                              className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-right font-mono text-slate-400"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={li.ytd_actual}
                              onChange={(e) => updateLineItem(idx, 'ytd_actual', Number(e.target.value))}
                              className="w-22 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-right font-mono"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={li.annual_budget}
                              onChange={(e) => updateLineItem(idx, 'annual_budget', Number(e.target.value))}
                              className="w-22 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-right font-mono text-slate-400"
                            />
                          </td>
                          <td className="py-2 pl-2 text-right">
                            <button
                              onClick={() => removeLineItem(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Remove Line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

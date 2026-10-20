import React from 'react';
export function PrimaryAction(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`primary-action ${props.className || ''}`} />;
}
export function ModuleHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return <header className="module-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><div className="module-actions">{children}</div></header>;
}
export function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="disclosure"><summary>{title}</summary><div className="disclosure-content">{children}</div></details>;
}
export function StatusMessage({ error, busy }: { error?: string; busy?: boolean }) {
  return <>{error && <p role="alert" className="request-error">{error}</p>}{busy && <p role="status" className="request-status">Working...</p>}</>;
}

import React from 'react';

export default function StatsBar({ history, modelAcc }) {
  const total = history.length;
  const phishCount = history.filter(h => h.isPhishing).length;
  const safeCount = total - phishCount;

  const stats = [
    { label: 'MODEL STATUS', value: modelAcc ? 'Active' : '—', color: '#00ff88' },
    { label: 'ANALYSIS TYPE', value: 'Real-time', color: '#00ff88' },
    { label: 'SCANS THIS SESSION', value: total, color: '#e8e8f0' },
    { label: 'THREATS DETECTED', value: phishCount, color: phishCount > 0 ? '#ff3366' : '#4a4a6a' },
  ];

  return (
    <div className="rounded-xl border border-border p-5" style={{ background: 'rgba(17,17,24,0.8)' }}>
      <p className="font-mono text-xs text-muted tracking-widest mb-4">MODEL STATS</p>
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div key={s.label} className="space-y-0.5">
            <p className="font-mono text-xs text-muted">{s.label}</p>
            <p className="font-display font-bold text-lg" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex justify-between font-mono text-xs mb-2">
            <span className="text-accent">{safeCount} safe</span>
            <span className="text-danger">{phishCount} phishing</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-white/5 flex">
            {safeCount > 0 && (
              <div
                className="h-full bg-accent/60 transition-all duration-700"
                style={{ width: `${(safeCount / total) * 100}%` }}
              />
            )}
            {phishCount > 0 && (
              <div
                className="h-full bg-danger/60 transition-all duration-700"
                style={{ width: `${(phishCount / total) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg border border-border/50 bg-white/2">
        <p className="font-mono text-xs text-muted/70 leading-relaxed">
          All analysis runs locally in your browser. No URL data is sent to any server.
        </p>
      </div>
    </div>
  );
}

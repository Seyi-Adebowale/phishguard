import React from 'react';

export default function FeatureImportance({ features }) {
  if (!features.length) return null;

  const max = features[0]?.importance || 1;

  return (
    <div className="rounded-xl border border-border p-5" style={{ background: 'rgba(17,17,24,0.8)' }}>
      <p className="font-mono text-xs text-muted tracking-widest mb-4">FEATURE IMPORTANCE</p>
      <div className="space-y-2.5">
        {features.map((f, i) => (
          <div key={f.key}>
            <div className="flex justify-between font-mono text-xs mb-1">
              <span className="text-dim truncate pr-2" title={f.name}>{f.name}</span>
              <span className="text-muted flex-shrink-0">{f.importance.toFixed(1)}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full feature-bar"
                style={{
                  width: `${(f.importance / max) * 100}%`,
                  background: i === 0
                    ? 'linear-gradient(90deg, #00ff88, #44ffaa)'
                    : i < 3
                    ? 'linear-gradient(90deg, #00cc66, #00ff88)'
                    : 'linear-gradient(90deg, #1e3a2a, #00aa55)',
                  opacity: 1 - i * 0.06,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="font-mono text-xs text-muted/50 mt-4 pt-3 border-t border-border/50">
        Top predictors from model training data
      </p>
    </div>
  );
}

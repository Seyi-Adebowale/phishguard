import React, { useState, useEffect, useRef } from 'react';
import { loadModel, predict, extractFeatures, getTopFeatures } from './model';
import ResultCard from './components/ResultCard';
import FeatureImportance from './components/FeatureImportance';
import StatsBar from './components/StatsBar';

export default function App() {
  const [url, setUrl] = useState('');
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    loadModel().then(m => {
      setModel(m);
      setModelLoading(false);
    });
  }, []);

  const handleAnalyze = async () => {
    if (!url.trim() || !model) return;
    
    const trimmedUrl = url.trim().toLowerCase();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setError('Please explicitly include http:// or https:// at the beginning of the URL.');
      return;
    }

    try {
      const urlObj = new URL(trimmedUrl);
      if (!urlObj.hostname.includes('.') && !urlObj.hostname.includes('localhost')) {
        setError('Please enter a complete, valid URL with a domain extension (e.g., https://example.com).');
        return;
      }
    } catch (e) {
      setError('Invalid URL format. Please check your spelling.');
      return;
    }

    setError('');
    setAnalyzing(true);
    setResult(null);
    setScanStatus('Initializing scan...');

    // await new Promise(r => setTimeout(r, 800)); // dramatic effect removed for live fetching

    const extracted = await extractFeatures(url.trim(), (status) => {
      setScanStatus(status);
    });
    if (!extracted) {
      setError('Invalid URL format. Please enter a valid URL.');
      setAnalyzing(false);
      return;
    }

    const prediction = predict(model, extracted.features);

    // Critical flags that warrant an immediate override
    const criticalFlags = [
      'IP address used instead of domain name',
      '@ symbol in URL',
      '"https" word in domain (spoofing)'
    ];
    const hasCriticalFlag = extracted.detectedFlags.some(flag => criticalFlags.includes(flag));

    // Override prediction if critical flags or typosquatting are detected
    if (extracted.typosquattingBrand || hasCriticalFlag) {
      prediction.isPhishing = true;
      prediction.confidence = Math.max(prediction.confidence, 92);
      prediction.phishingProb = Math.max(prediction.phishingProb, 92);
      prediction.legitimateProb = Math.min(prediction.legitimateProb, 8);
    }

    const fullResult = { ...prediction, ...extracted, url: url.trim(), timestamp: Date.now() };
    setResult(fullResult);
    setHistory(prev => [fullResult, ...prev.slice(0, 4)]);
    setAnalyzing(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const topFeatures = model ? getTopFeatures(model) : [];

  return (
    <div className="relative min-h-screen text-text" style={{ zIndex: 1 }}>
      <div className="scan-line" />

      {/* Header */}
      <header className="relative border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border border-accent/40 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 7 3.5-.5 6-3.5 6-7V4L8 1z" stroke="#00ff88" strokeWidth="1.2" fill="rgba(0,255,136,0.1)"/>
              <path d="M5 8l2 2 4-4" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-text">
            Phish<span className="text-accent">Sentinel</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-muted">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${modelLoading ? 'bg-warn animate-pulse' : 'bg-accent'}`} />
            {modelLoading ? 'LOADING MODEL' : 'MODEL READY'}
          </span>
          <span className="hidden sm:block">AI ENGINE ACTIVE</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 relative z-10">

        {/* Hero */}
        <div className="mb-12 animate-slide-up">
          <p className="font-mono text-accent text-xs tracking-widest mb-3">AI-POWERED THREAT DETECTION</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl leading-none tracking-tight mb-4">
            Detect phishing<br />
            <span className="text-accent">before it strikes.</span>
          </h1>
          <p className="text-dim text-base sm:text-lg max-w-xl leading-relaxed">
            Enter any URL to instantly analyze it with our machine learning model trained on{' '}
            <span className="text-text font-medium">thousands of real-world examples</span>.
            No data leaves your browser.
          </p>
        </div>

        {/* Input */}
        <div className="animate-slide-up animate-slide-up-delay-1 mb-10">
          <div className={`relative border rounded-lg transition-all duration-300 ${
            analyzing ? 'border-accent/60' : 'border-border hover:border-muted focus-within:border-accent/60'
          }`} style={{ background: 'rgba(17,17,24,0.8)' }}>
            <div className="flex items-center px-4 py-1 border-b border-border/50 gap-2">
              <span className="font-mono text-xs text-muted">URL_INPUT</span>
              {analyzing && (
                <span className="ml-auto font-mono text-xs text-accent animate-pulse">{scanStatus ? scanStatus.toUpperCase() : 'SCANNING...'}</span>
              )}
            </div>
            <div className="flex items-center">
              <span className="pl-4 font-mono text-muted text-sm select-none">›</span>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKey}
                placeholder="https://example.com"
                disabled={analyzing || modelLoading}
                className="flex-1 bg-transparent font-mono text-base text-text px-3 py-4 outline-none placeholder-muted disabled:opacity-50"
              />
              <button
                onClick={handleAnalyze}
                disabled={!url.trim() || analyzing || modelLoading}
                className="m-2 px-5 py-2.5 rounded bg-accent/10 border border-accent/30 text-accent font-mono text-sm font-medium
                  hover:bg-accent/20 hover:border-accent/60 transition-all duration-200
                  disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              >
                {analyzing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14">
                      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="20" strokeDashoffset="5"/>
                    </svg>
                    SCAN
                  </span>
                ) : 'SCAN →'}
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-2 text-danger text-xs font-mono px-1">{error}</p>
          )}
        
        </div>

        {/* Result */}
        {result && (
          <div className="animate-slide-up mb-10">
            <ResultCard result={result} />
          </div>
        )}

        {/* Two-column: stats + feature importance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-slide-up animate-slide-up-delay-2">
          <StatsBar history={history} modelAcc={model?.acc} />
          <FeatureImportance features={topFeatures} />
        </div>

        {/* History */}
        {history.length > 1 && (
          <div className="mt-8 animate-slide-up">
            <p className="font-mono text-xs text-muted mb-3 tracking-widest">SCAN HISTORY</p>
            <div className="space-y-2">
              {history.slice(1).map((h, i) => (
                <button
                  key={h.timestamp}
                  onClick={() => { setUrl(h.url); setResult(h); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded border border-border hover:border-muted/50 transition-all text-left"
                  style={{ background: 'rgba(17,17,24,0.6)' }}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${h.isPhishing ? 'bg-danger' : 'bg-accent'}`} />
                  <span className="font-mono text-xs text-dim flex-1 truncate">{h.url}</span>
                  <span className={`font-mono text-xs font-medium flex-shrink-0 ${h.isPhishing ? 'text-danger' : 'text-accent'}`}>
                    {h.isPhishing ? 'PHISH' : 'SAFE'} {h.confidence}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 mt-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-xs text-muted">
            PhishSentinel · AI-Powered Threat Detection · Runs 100% in-browser
          </p>
          <p className="font-mono text-xs text-muted">
            Built with React, Tailwind CSS & Python
          </p>
        </div>
      </footer>
    </div>
  );
}

import React, { useEffect, useState, useCallback, useRef } from 'react';

const DURATION = 23000;

/* ─── timing helpers ──────────────────────────────────────────────── */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp   = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function useClock() {
  const [t, setT]       = useState(0);
  const [paused, setPaused] = useState(false);
  const baseRef  = useRef(Date.now());
  const offsetRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setT(clamp(Date.now() - baseRef.current + offsetRef.current, 0, DURATION));
    }, 40);
    return () => clearInterval(id);
  }, [paused]);

  const restart = useCallback(() => {
    baseRef.current  = Date.now();
    offsetRef.current = 0;
    setT(0);
    setPaused(false);
  }, []);

  const toggle = useCallback(() => {
    if (paused) {
      baseRef.current = Date.now();
      setPaused(false);
    } else {
      offsetRef.current = t;
      setPaused(true);
    }
  }, [paused, t]);

  return { t, paused, restart, toggle, done: t >= DURATION };
}

/* ─── per-timestamp helpers ───────────────────────────────────────── */
const fadeIn  = (t, start, dur = 500) => easeOut(clamp((t - start) / dur, 0, 1));
const slideIn = (t, start, dur = 500) => {
  const p = easeOut(clamp((t - start) / dur, 0, 1));
  return { opacity: p, transform: `translateY(${lerp(18, 0, p)}px)` };
};
const sceneOp = (t, enter, exit) => {
  const inP  = easeOut(clamp((t - enter) / 500, 0, 1));
  const outP = exit ? easeOut(clamp((t - exit)  / 400, 0, 1)) : 0;
  return clamp(inP - outP, 0, 1);
};

/* ─── SVG Pipeline ────────────────────────────────────────────────── */
const NODE = {
  you:       { x: 55,  y: 160, icon: '👤', label: 'You',              color: '#6b7280' },
  director:  { x: 210, y: 160, icon: '👑', label: 'Research Director', color: '#3b82f6' },
  financial: { x: 400, y: 65,  icon: '🧠', label: 'Financial',         color: '#60a5fa' },
  risk:      { x: 400, y: 160, icon: '🧠', label: 'Risk',              color: '#60a5fa' },
  market:    { x: 400, y: 255, icon: '🧠', label: 'Market',            color: '#60a5fa' },
};

function PipelineNode({ nx, t, appear, active, done }) {
  const op = fadeIn(t, appear);
  const glow = active || done;
  return (
    <g style={{ opacity: op }} transform={`translate(${nx.x}, ${nx.y})`}>
      {glow && (
        <circle r="30" fill={nx.color} opacity="0.15">
          <animate attributeName="r" values="28;34;28" dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.12;0.22;0.12" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle r="22" fill="#111827" stroke={glow ? nx.color : '#374151'} strokeWidth={glow ? 2 : 1.5} />
      <text textAnchor="middle" dominantBaseline="central" fontSize="13">{nx.icon}</text>
      <text y="32" textAnchor="middle" fontSize="8.5" fill="#9ca3af">{nx.label}</text>
    </g>
  );
}

function Edge({ x1, y1, x2, y2, draw, animated, dashed, color = '#3b82f6' }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const offset = lerp(len, 0, easeOut(clamp(draw, 0, 1)));
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color}
      strokeWidth={animated ? 2 : 1.5}
      strokeDasharray={dashed ? '5 3' : `${len}`}
      strokeDashoffset={dashed ? undefined : offset}
      opacity={draw > 0 ? 1 : 0}
    />
  );
}

function Pulse({ x1, y1, x2, y2, show, color = '#f97316' }) {
  if (!show) return null;
  return (
    <circle r="5" fill={color} opacity="0.9">
      <animateMotion dur="0.9s" repeatCount="1" fill="freeze"
        path={`M${x1},${y1} L${x2},${y2}`} />
    </circle>
  );
}

function Pipeline({ t }) {
  /* node appear timings */
  const ap = { you: 2600, director: 3100, financial: 3600, risk: 3900, market: 4200 };
  /* edge draw timings (0→1 progress) */
  const edgeYD  = clamp((t - 3350) / 350, 0, 1);
  const edgeDF  = clamp((t - 3700) / 350, 0, 1);
  const edgeDR  = clamp((t - 4000) / 350, 0, 1);
  const edgeDM  = clamp((t - 4300) / 350, 0, 1);

  /* active states during run scene */
  const dirActive = t >= 7000 && t < 11200;
  const workerActive = t >= 7700 && t < 10800;
  const youDone  = t >= 6500;
  const dirDone  = t >= 10800;
  const wkDone   = t >= 10200;

  /* message pulse timings */
  const pulses = [
    { key: 'yd',  x1: 77, y1: 160, x2: 188, y2: 160, show: between(t, 6000, 6900), color: '#3b82f6' },
    { key: 'df',  x1: 232, y1: 160, x2: 378, y2: 65,  show: between(t, 7000, 7900), color: '#f97316' },
    { key: 'dr',  x1: 232, y1: 160, x2: 378, y2: 160, show: between(t, 7050, 7950), color: '#f97316' },
    { key: 'dm',  x1: 232, y1: 160, x2: 378, y2: 255, show: between(t, 7100, 8000), color: '#f97316' },
    { key: 'fd',  x1: 378, y1: 65,  x2: 232, y2: 160, show: between(t, 9200, 10100), color: '#22c55e' },
    { key: 'rd',  x1: 378, y1: 160, x2: 232, y2: 160, show: between(t, 9300, 10200), color: '#22c55e' },
    { key: 'md',  x1: 378, y1: 255, x2: 232, y2: 160, show: between(t, 9400, 10300), color: '#22c55e' },
  ];

  return (
    <svg viewBox="0 0 500 320" width="500" height="320" style={{ overflow: 'visible' }}>
      {/* edges */}
      <Edge x1={77}  y1={160} x2={188} y2={160} draw={edgeYD} color="#3b82f6" />
      <Edge x1={232} y1={160} x2={378} y2={65}  draw={edgeDF} dashed color="#f97316" />
      <Edge x1={232} y1={160} x2={378} y2={160} draw={edgeDR} dashed color="#f97316" />
      <Edge x1={232} y1={160} x2={378} y2={255} draw={edgeDM} dashed color="#f97316" />

      {/* nodes */}
      <PipelineNode nx={NODE.you}       t={t} appear={ap.you}       active={false}         done={youDone} />
      <PipelineNode nx={NODE.director}  t={t} appear={ap.director}  active={dirActive}     done={dirDone} />
      <PipelineNode nx={NODE.financial} t={t} appear={ap.financial} active={workerActive}  done={wkDone} />
      <PipelineNode nx={NODE.risk}      t={t} appear={ap.risk}      active={workerActive}  done={wkDone} />
      <PipelineNode nx={NODE.market}    t={t} appear={ap.market}    active={workerActive}  done={wkDone} />

      {/* traveling pulses */}
      {pulses.map(p => <Pulse key={p.key} {...p} />)}
    </svg>
  );
}

/* ─── Fan-in diagram ─────────────────────────────────────────────── */
function FanIn({ t }) {
  const base = 16000;
  const sources = [
    { label: 'Financial', y: 60,  arrive: base + 700,  color: '#60a5fa' },
    { label: 'Risk',      y: 150, arrive: base + 1200, color: '#60a5fa' },
    { label: 'Market',    y: 240, arrive: base + 1800, color: '#60a5fa' },
  ];
  const fires = t >= base + 1800 + 700;

  return (
    <svg viewBox="0 0 400 300" width="380" height="260" style={{ overflow: 'visible' }}>
      {sources.map((s, i) => {
        const arrived = t >= s.arrive;
        return (
          <g key={s.label}>
            <circle cx="80" cy={s.y} r="22" fill="#111827"
              stroke={arrived ? s.color : '#374151'} strokeWidth={arrived ? 2 : 1.5}
              style={{ opacity: fadeIn(t, base + 300 + i * 100) }}
            />
            <text x="80" y={s.y} textAnchor="middle" dominantBaseline="central"
              fontSize="8.5" fill={arrived ? '#fff' : '#6b7280'}
              style={{ opacity: fadeIn(t, base + 300 + i * 100) }}>
              🧠 {s.label}
            </text>
            {/* edge to buffer */}
            <line x1={103} y1={s.y} x2={220} y2={150}
              stroke={arrived ? s.color : '#1f2937'} strokeWidth="1.5"
              strokeDasharray="4 3"
              style={{ opacity: fadeIn(t, base + 300 + i * 100) }} />
            {/* message pulse */}
            {t >= s.arrive && t < s.arrive + 800 && (
              <circle r="5" fill={s.color}>
                <animateMotion dur="0.65s" fill="freeze"
                  path={`M103,${s.y} L220,150`} />
              </circle>
            )}
            {/* tick in buffer */}
            <text x="230" y={s.y < 100 ? 110 : s.y < 200 ? 150 : 190}
              fontSize="10" fill={arrived ? '#22c55e' : '#374151'}
              style={{ opacity: fadeIn(t, s.arrive + 500) }}>
              {arrived ? '✓' : '·'}
            </text>
          </g>
        );
      })}

      {/* buffer box */}
      <rect x="215" y="110" width="80" height="80" rx="8"
        fill="#111827" stroke={fires ? '#22c55e' : '#374151'} strokeWidth={fires ? 2 : 1.5}
        style={{ opacity: fadeIn(t, base + 400) }} />
      <text x="255" y="148" textAnchor="middle" fontSize="8" fill="#9ca3af"
        style={{ opacity: fadeIn(t, base + 400) }}>buffer</text>
      <text x="255" y="162" textAnchor="middle" fontSize="8" fill={fires ? '#22c55e' : '#6b7280'}
        style={{ opacity: fadeIn(t, base + 400) }}>run_id</text>

      {/* output node */}
      {fires && (
        <g style={{ opacity: fadeIn(t, base + 2600) }}>
          <circle cx="345" cy="150" r="22" fill="#111827" stroke="#22c55e" strokeWidth="2" />
          <text x="345" y="150" textAnchor="middle" dominantBaseline="central" fontSize="10">🔗</text>
          <text x="345" y="178" textAnchor="middle" fontSize="8" fill="#9ca3af">Synthesis</text>
          <line x1="296" y1="150" x2="323" y2="150" stroke="#22c55e" strokeWidth="1.5" />
          <circle r="5" fill="#22c55e">
            <animateMotion dur="0.6s" fill="freeze" path="M296,150 L323,150" />
          </circle>
        </g>
      )}
    </svg>
  );
}

/* ─── Observe panels ─────────────────────────────────────────────── */
function ObservePanels({ t }) {
  const base = 12500;
  const logs = [
    { ts: '10:21:04', agent: 'financial', msg: 'Processing: Analyze Tesla' },
    { ts: '10:21:04', agent: 'risk',      msg: 'Processing: Analyze Tesla' },
    { ts: '10:21:04', agent: 'market',    msg: 'Processing: Analyze Tesla' },
    { ts: '10:21:06', agent: 'financial', msg: 'Complete — 2.1s' },
    { ts: '10:21:06', agent: 'risk',      msg: 'Complete — 2.3s' },
  ];
  const tests = [
    { name: 'Summarise Apple',    pass: true },
    { name: 'Analyse risk Uber',  pass: true },
    { name: 'Market position AMD',pass: true },
  ];

  return (
    <div className="flex gap-4 w-full max-w-3xl">
      {/* Stats */}
      <div className="flex-1" style={slideIn(t, base + 300)}>
        <Panel title="Stats">
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[['14', 'runs'], ['92%', 'success'], ['2.3s', 'avg latency'], ['3', 'agents']].map(([v, l]) => (
              <div key={l} className="bg-gray-800/60 rounded-lg p-2 text-center">
                <div className="text-blue-400 font-bold text-lg">{v}</div>
                <div className="text-gray-500 text-[10px]">{l}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {/* Logs */}
      <div className="flex-1" style={slideIn(t, base + 600)}>
        <Panel title="Logs">
          <div className="flex flex-col gap-1 mt-1 font-mono text-[9px]">
            {logs.map((l, i) => (
              <div key={i} className="flex gap-2 text-gray-400"
                style={{ opacity: fadeIn(t, base + 800 + i * 200) }}>
                <span className="text-gray-600 shrink-0">{l.ts}</span>
                <span className="text-blue-400 shrink-0">{l.agent}</span>
                <span className="truncate">{l.msg}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {/* Tests */}
      <div className="flex-1" style={slideIn(t, base + 900)}>
        <Panel title="Tests">
          <div className="flex flex-col gap-1.5 mt-1">
            {tests.map((t2, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-800/60 rounded px-2 py-1.5"
                style={{ opacity: fadeIn(t, base + 1100 + i * 250) }}>
                <span className="text-green-400 text-xs font-bold">✓</span>
                <span className="text-gray-300 text-[10px] truncate">{t2.name}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3 h-full backdrop-blur-sm">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{title}</div>
      {children}
    </div>
  );
}

/* ─── Caption ────────────────────────────────────────────────────── */
function Caption({ t, start, end, children }) {
  const op = sceneOp(t, start, end);
  return (
    <p className="text-center text-sm text-gray-400 max-w-lg leading-relaxed"
      style={{ opacity: op, transform: `translateY(${lerp(10, 0, op)}px)` }}>
      {children}
    </p>
  );
}

/* ─── Progress bar ───────────────────────────────────────────────── */
function ProgressBar({ t, paused, toggle, restart, done, onExit }) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
      <button onClick={toggle}
        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs transition-colors">
        {paused ? '▶' : '⏸'}
      </button>
      <div className="w-56 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-none"
          style={{ width: `${(t / DURATION) * 100}%` }} />
      </div>
      <button onClick={restart}
        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs transition-colors">
        ↺
      </button>
      {onExit && (
        <button onClick={onExit}
          className="text-gray-600 hover:text-gray-400 text-xs transition-colors ml-1">
          ✕
        </button>
      )}
    </div>
  );
}

/* ─── between helper ─────────────────────────────────────────────── */
function between(t, a, b) { return t >= a && t < b; }

/* ─── Main ───────────────────────────────────────────────────────── */
export default function Demo({ onExit }) {
  const { t, paused, restart, toggle, done } = useClock();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: '#070b12' }}>

      {/* ── SCENE 1: Intro (0 – 2500ms) ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
        style={{ opacity: sceneOp(t, 0, 2200) }}>
        <div style={slideIn(t, 300, 700)}>
          <span className="text-5xl">🕸️</span>
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight" style={slideIn(t, 600, 600)}>
          Multi-Agent Studio
        </h1>
        <p className="text-gray-400 text-lg" style={slideIn(t, 1000, 600)}>
          Build · Run · Monitor AI pipelines
        </p>
        <div className="flex gap-6 mt-2" style={slideIn(t, 1500, 600)}>
          {['NATS JetStream', 'LangGraph', 'OpenAI · Anthropic · Mistral'].map(tag => (
            <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full border border-blue-800/60 text-blue-400 bg-blue-950/30">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── SCENE 2: Build the pipeline (2500 – 5500ms) ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none"
        style={{ opacity: sceneOp(t, 2200, 5200) }}>
        <Pipeline t={t} />
        <Caption t={t} start={4700} end={5200}>
          Connect agents visually. Each edge becomes a{' '}
          <span className="text-blue-400 font-medium">NATS JetStream subject</span> — no plumbing to write.
        </Caption>
      </div>

      {/* ── SCENE 3: Run (5500 – 12500ms) ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none"
        style={{ opacity: sceneOp(t, 5200, 12200) }}>
        {/* Input bubble */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          style={{ opacity: sceneOp(t, 5500, 6200) }}>
          <div className="bg-blue-950/60 border border-blue-700/50 rounded-xl px-4 py-2 text-sm text-blue-200 font-mono">
            "Analyze Tesla for me"
          </div>
          <div className="text-[10px] text-gray-600">▼ sent to pipeline</div>
        </div>

        <Pipeline t={t} />

        {/* Dispatch label */}
        <div className="absolute top-[55%] left-1/2 -translate-x-1/2"
          style={{ opacity: sceneOp(t, 7000, 9800) }}>
          <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-800/40 rounded-lg px-3 py-1.5">
            <span className="text-orange-400 text-xs font-mono">asyncio.gather()</span>
            <span className="text-gray-400 text-[10px]">3 workers dispatched in parallel</span>
          </div>
        </div>

        {/* Result */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2"
          style={slideIn(t, 10800, 500)}>
          <div className="bg-green-950/40 border border-green-700/40 rounded-xl px-5 py-3 text-sm text-green-300 font-medium">
            ✓ Tesla analysis complete — 2.1s
          </div>
        </div>

        <Caption t={t} start={11600} end={12200}>
          Total latency ≈ <span className="text-orange-400 font-medium">max(workers)</span>, not sum.{' '}
          NATS delivers all 3 dispatches simultaneously.
        </Caption>
      </div>

      {/* ── SCENE 4: Observe (12500 – 16000ms) ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none"
        style={{ opacity: sceneOp(t, 12200, 15700) }}>
        <h2 className="text-xl font-bold text-white mb-1" style={slideIn(t, 12500)}>
          Every run is observable
        </h2>
        <ObservePanels t={t} />
        <Caption t={t} start={14200} end={15700}>
          Logs, stats, and <span className="text-blue-400 font-medium">batch test cases</span> — catch regressions before they hit production.
        </Caption>
      </div>

      {/* ── SCENE 5: Fan-in (16000 – 19500ms) ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none"
        style={{ opacity: sceneOp(t, 15700, 19200) }}>
        <h2 className="text-xl font-bold text-white mb-1" style={slideIn(t, 16000)}>
          Fan-in aggregation
        </h2>
        <FanIn t={t} />
        <Caption t={t} start={18200} end={19200}>
          The buffer holds partial results by <span className="text-blue-400 font-mono text-xs">run_id</span> and fires only when{' '}
          <span className="text-green-400 font-medium">all parallel branches</span> have arrived.
        </Caption>
      </div>

      {/* ── SCENE 6: End (19500 – 23000ms) ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none"
        style={{ opacity: sceneOp(t, 19200, 999999) }}>
        <span className="text-5xl" style={slideIn(t, 19500)}>🕸️</span>
        <h1 className="text-3xl font-bold text-white tracking-tight" style={slideIn(t, 19700, 600)}>
          Multi-Agent Studio
        </h1>
        <div className="flex gap-3 mt-1" style={slideIn(t, 20200, 600)}>
          {[
            { label: 'Orchestrator pattern', color: 'blue' },
            { label: 'Pub/sub with NATS',    color: 'blue' },
            { label: 'Fan-in buffering',     color: 'green' },
            { label: 'LangGraph ReAct',      color: 'purple' },
            { label: 'Full observability',   color: 'orange' },
          ].map(({ label, color }) => (
            <span key={label}
              className={`text-[10px] px-2.5 py-1 rounded-full border font-medium
                ${color === 'blue'   ? 'border-blue-700/60 text-blue-400 bg-blue-950/30' : ''}
                ${color === 'green'  ? 'border-green-700/60 text-green-400 bg-green-950/30' : ''}
                ${color === 'purple' ? 'border-purple-700/60 text-purple-400 bg-purple-950/30' : ''}
                ${color === 'orange' ? 'border-orange-700/60 text-orange-400 bg-orange-950/30' : ''}
              `}>
              {label}
            </span>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-3" style={slideIn(t, 20700, 600)}>
          github.com/lalanne — Multi-Agent Studio
        </p>
        {onExit && (
          <button onClick={onExit}
            className="mt-4 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors pointer-events-auto"
            style={{ opacity: fadeIn(t, 21200) }}>
            Open the builder →
          </button>
        )}
      </div>

      {/* Controls */}
      <ProgressBar t={t} paused={paused} toggle={toggle} restart={restart} done={done} onExit={onExit} />
    </div>
  );
}

# Multi-Agent Studio

> A local no-code environment for building, running, and monitoring multi-agent AI pipelines.

---

## What it is

Multi-Agent Studio is a visual builder for multi-agent systems. You drag agents onto a canvas, connect them, configure their prompts and models, then hit **Start** — the system compiles your graph into Python processes that communicate over **NATS JetStream**, with every message, run, and log persisted to **SQLite**.

The goal is to make the core patterns of agentic AI (orchestration, parallelism, fan-in, tool use) tangible and observable without writing infrastructure code.

---

## Architecture

```
Browser UI ──HTTP/WS──> Express (:3001) ──spawns──> Python daemons  (1 per agent)
                             │                              │
                             └── monitors ── NATS JetStream (:4222) ──┘
                             └── logs ──────> SQLite (data/studio.db)
```

Each agent runs as an **isolated Python process**. The UI compiles the graph to disk (`agents/<id>/agent.yaml` + `runner.py`), then the process manager boots one `core/daemon.py` per agent. The daemon connects to NATS, subscribes to its upstream subjects, calls `runner.handle()` on each message, and publishes the result downstream. The UI monitors all of this over WebSocket in real time.

### Why NATS JetStream?

Three reasons:

1. **Natural parallelism.** An orchestrator can dispatch 3 specialist agents simultaneously by publishing to 3 subjects — no threads, no locks, no orchestration loop to write. Each agent picks up its message independently.

2. **Durable consumers.** JetStream consumers survive agent crashes. A restarted agent picks up where it left off — no message is lost mid-run.

3. **Decoupling.** Adding a new agent to a pipeline is adding a subscription. The other agents don't change. This is the same property that makes event-driven architectures scale in production.

---

## Agent types and the patterns they implement

### 👑 Manager (Orchestrator pattern)
Receives a user request via NATS, then calls its connected workers **in parallel as LLM tool calls** (via `asyncio.gather`). Once all workers respond, the manager synthesizes their outputs. This is the standard *orchestrator–worker* pattern: one coordinator, N parallel specialists, one synthesis step.

```
You ──NATS request──> Research Director
                           ├──tool call──> Financial Analyst
                           ├──tool call──> Risk Analyst
                           └──tool call──> Market Analyst
                                 (parallel, ~same latency as one)
                           └──────────── synthesis ──> final answer
```

### 🧠 Specialist (LLM Worker)
A single LLM call with a focused system prompt. Configurable provider (OpenAI / Anthropic / Mistral), model, temperature. No code to write — just a prompt.

### 🔎 Smart Agent (LangGraph ReAct)
A full **ReAct agent loop** backed by LangGraph. Unlike a Specialist, it can use tools, reason over multi-step problems, and decide when it has enough information. Custom Python `@tool` functions are injected at runtime from the `tools/` directory.

### ⚙️ Function (Python)
Arbitrary Python. The `handle(input, context)` contract is minimal — the context gives you `run_id`, `config`, a live NATS JetStream handle, and a `log()` function. Use it for data transformation, API calls, or anything LLMs shouldn't be doing.

---

## Fan-in buffering

When an agent has **multiple upstream sources**, enabling *fan-in* tells it to wait for all of them before processing. The daemon uses an async buffer keyed by `run_id`:

```python
# core/fan_in_buffer.py
async def receive(self, run_id, subject, payload):
    async with self._lock:
        self._buffer.setdefault(run_id, {})[subject] = payload
        if set(self._buffer[run_id].keys()) >= self.required:
            return self._buffer.pop(run_id)
    return None
```

Concretely: a synthesis agent waiting on Financial + Risk + Market analysts will buffer each partial result under the same `run_id` and only fire once all three have arrived. This is the standard pattern for aggregating parallel branches in an agentic pipeline.

---

## Observability

- **Stats** — run count, success rate, average latency, per-agent activity
- **Logs** — structured `(run_id, agent_id, level, message)` rows, filterable per run
- **NATS monitor** — live message stream with envelopes, subjects, and payloads
- **Tests** — save input/expected pairs, run batches, get pass/fail per test case — regression testing for agent behavior without a CI pipeline

---

## Tool Builder

A built-in code editor (Monaco + GPT-4o) for generating Python `@tool` functions. Describe what you need in plain English, get a function back, edit it, save it. Tools are stored in `tools/` and immediately available to Smart Agents via the `ToolSelector` in the agent panel.

---

## Quick start

**Requirements:** Node.js 20+, Python 3.11+, `nats-server` on PATH  
(`brew install nats-server` on macOS)

```bash
cp .env.example .env          # add OPENAI_API_KEY (and/or ANTHROPIC_API_KEY, MISTRAL_API_KEY)
npm install
cd client && npm install && cd ..
pip install -r requirements.txt
npm run build                 # build React client
npm start                     # starts NATS + Express, serves UI on :3001
```

Open **http://localhost:3001**

**Dev mode (hot reload):**
```bash
# terminal 1 — Vite
cd client && npm run dev
# terminal 2 — Express
npm run dev
```

**Smoke test (no browser):**
```bash
node scripts/e2e-check.js     # builds a 3-agent pipeline, verifies the full run path
```

---

## 90-second walkthrough

1. Left panel → name → `+` → new system, or **✦ Load example** for the Company Analysis pipeline
2. Drag agents from the toolbar; connect them (right handle → left handle)
3. Click a node → configure model, prompt, tools in the right panel
4. **▶ Start agents** — each node compiles to a Python daemon; badge turns green
5. Bottom panel → type a prompt → **▶ Run**
6. Watch edges pulse, monitor the NATS tab, read the final result
7. Run the Tests tab to check the system still behaves after prompt edits

---

## Project layout

```
core/
  daemon.py          # universal agent runtime — one process per node
  fan_in_buffer.py   # async buffer for multi-source aggregation
  message.py         # MessageEnvelope schema
  db_logger.py       # writes events + logs to SQLite

server/
  agent-files.js     # compiles graph → agent.yaml + runner.py on disk
  process-manager.js # spawn / stop Python daemons, pipe stdout → WebSocket
  nats.js            # NATS monitor (subscribes to > for live message stream)
  routes/            # REST API: systems, runs, agents, tools, tests, stats

client/src/
  components/
    GraphBuilder/    # ReactFlow canvas, toolbar, edge styling
    AgentPanel/      # node config drawer (model, prompt, tools, code)
    StatsPanel/      # run metrics and agent activity
    TestPanel/       # batch test runner
    NATSMonitor/     # live message stream
    ToolBuilder/     # AI-assisted @tool generator
  store/useStudio.js # Zustand state (graph, runs, WebSocket, pulses)

agents/<id>/         # generated per node — agent.yaml rewritten on save,
                     # runner.py scaffolded once then yours to edit
tools/               # user-created Python @tool functions for Smart Agents
data/studio.db       # SQLite: systems, agents, runs, events, logs, test_cases
```

---

## Technical decisions worth noting

| Decision | Rationale |
|---|---|
| One daemon per agent | Process isolation — a crash in one agent doesn't take down others |
| NATS JetStream (not HTTP calls) | Durable consumers + natural fan-out without coordination code |
| Orchestrator calls workers directly (not via NATS) | Avoids circular graphs; workers are synchronous tool calls, not peers |
| `runner.py` scaffold-once | Lets users edit code freely without the UI overwriting it on save |
| SQLite | Zero infrastructure for persistence; `run_id` as the coordination key across all tables |
| Monaco in-browser editor | Edit Python agent code without leaving the UI |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Run stays "running", no result | Check **Logs tab** — likely a missing/invalid API key or agent exception |
| Agent badge never turns green | `python3` or a pip dependency missing — check the terminal running `npm start` |
| `nats-server not found` | `brew install nats-server` or place the binary in `nats-bin/` at project root |
| Port 3001 in use | `lsof -ti:3001 \| xargs kill` |

---

## Stop everything

```bash
lsof -ti:3001 | xargs kill; pkill -f nats-server; pkill -f core/daemon.py
```

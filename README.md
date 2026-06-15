# Multi-Agent Studio

Local GUI to build, visualize, and run multi-agent systems. Agents talk over
**NATS JetStream**, everything is logged to **SQLite**, and any system exports
to a self-contained **ZIP**.

```
Browser UI ──HTTP/WS──> Express (:3001) ──spawns──> Python daemons (1 per agent)
                              │                              │
                              └── monitors ── NATS JetStream (:4222) ──┘
                              └── logs ──────> SQLite (data/studio.db)
```

---

## 1. Requirements
- Node.js 20+
- Python 3.11+
- `nats-server` on PATH — `brew install nats-server`

## 2. Setup
```bash
cp .env.example .env                  # then edit: OPENAI_API_KEY / ANTHROPIC_API_KEY
npm install
cd client && npm install && cd ..
pip install -r requirements.txt       # bootstrap also attempts this
```

## 3. Run
```bash
npm run build      # build the React client once (prod mode)
npm start          # boots NATS + SQLite + Express, serves UI on :3001
```
Open **http://localhost:3001**

Dev mode (frontend hot-reload):
```bash
# terminal 1
cd client && npm run dev      # Vite on :5173
# terminal 2
npm run dev                   # Express proxies Vite
```

Stop everything:
```bash
lsof -ti:3001 | xargs kill; pkill -f nats-server; pkill -f core/daemon.py
```

Smoke test (no browser):
```bash
node scripts/e2e-check.js     # builds a 3-agent pipeline, verifies the full path
```

---

## 4. The 90-second workflow (UI)

1. **Left panel** → type a name → `+` → new system.
2. **Drag** an agent from the toolbar (🧠 LLM / 🕸️ LangGraph / 🐍 Python) onto the canvas.
3. **Connect** agents: drag from a node's right handle to the next node's left handle.
   Each edge `A → B` auto-creates NATS subject `agent.A.output` (A publishes, B subscribes).
4. **Click a node** → right drawer → configure (model, prompt, code…). Autosaves.
5. **▶ Start agents** (toolbar) → each node spawns a Python daemon → badge turns green.
6. **Bottom panel** → paste input → **▶ Run**.
7. Watch: edges pulse orange, **NATS tab** streams every message, **final result** shows on the right.
8. **Logs tab** → filter by run to debug.
9. **⬇ Export ZIP** (left) → portable copy of the whole system + logs.

---

## 5. How an agent connects to NATS (you don't wire this by hand)

There is **one universal daemon**: `core/daemon.py`. When you click *Start agents*,
the backend (`server/process-manager.js`) spawns it once per node:

```
python3 core/daemon.py --agent agents/<id>
```

The daemon then, automatically:
1. reads `agents/<id>/agent.yaml`,
2. connects to NATS (`NATS_URL`, default `nats://localhost:4222`),
3. subscribes to every subject in `subscribes:` (durable JetStream consumers),
4. on each message: runs your `runner.py:handle()`, then publishes the result
   to every subject in `publishes:`,
5. logs every event/message to SQLite.

**You never write connection code.** Subjects come from the graph edges. The only
things you author are the *prompt/config* (agent.yaml, via the UI) and, for
`python`/`langgraph`, the *logic* (`runner.py` / `graph.py`).

### Subject naming convention
| Situation | Subject |
|---|---|
| Agent output | `agent.<id>.output` |
| Entry agent input (no incoming edge) | `agent.<id>.input` (backend publishes the run here) |
| Agent with N sources | subscribes to each `agent.<src>.output` |

### Entry / terminal / fan-in
- **Entry** = node with no incoming edge. The run input is injected here. Multiple
  entries → all started in parallel with the same `run_id`.
- **Terminal** = node with no outgoing edge. Its output is the run's final result.
- **Fan-in**: tick *"wait for all source agents"* on a node with 2+ sources. It
  buffers messages by `run_id` and only fires `handle()` once every source has
  arrived (the combined inputs are passed as a JSON object).

---

## 6. Where to edit agent code

Each agent lives in `agents/<id>/`:

```
agents/<id>/
├── agent.yaml    # config (type, subjects, llm, prompt, timeout) — ALWAYS regenerated from the UI
├── runner.py     # the logic: async def handle(input_text, context) -> str
└── graph.py      # LangGraph only: build_graph(config) -> compiled graph
```

> **Important:** `agent.yaml` is rewritten on every graph save (it carries the UI
> config). `runner.py` and `graph.py` are **scaffolded once, then yours** — edit
> them freely, graph re-saves won't clobber them. Because `runner.py` reads
> `agent.yaml` at runtime, changing the model/prompt in the UI still takes effect
> without touching `runner.py`.

### By type

**🧠 `llm_worker`** — no code editing needed.
Set provider / model / temperature / system prompt in the right drawer. The stock
`runner.py` reads them from `agent.yaml` and calls OpenAI or Anthropic.

**🐍 `python`** — write arbitrary logic.
Edit `runner.py` directly **in the Monaco editor** inside the drawer → *Save code*
(writes the file). Or edit `agents/<id>/runner.py` on disk. Contract:
```python
async def handle(input_text: str, context: dict) -> str:
    # context: run_id, system_id, agent_id, config, js (NATS jetstream),
    #          log(level, message)
    context["log"]("info", "doing work")
    return "result string"   # becomes the message published downstream
```

**🕸️ `langgraph`** — customize the graph/tools.
`runner.py` is a thin wrapper; put your real logic in `agents/<id>/graph.py`:
```python
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

def build_graph(config: dict):
    cfg = config.get("llm", {})
    model = ChatOpenAI(model=cfg.get("model", "gpt-4o"),
                       temperature=cfg.get("temperature", 0.7))
    tools = []          # <-- add your @tool functions here
    return create_react_agent(model, tools)
```
After editing files on disk, click **Stop agents** then **Start agents** to reload.

### The `context` dict passed to every `handle()`
| Key | What |
|---|---|
| `run_id` | shared id for this run (fan-in key) |
| `system_id` | the system being run |
| `agent_id` | this agent's id |
| `config` | the parsed `agent.yaml` (read `config["llm"]`, `config["tools"]`, …) |
| `js` | live NATS JetStream handle (advanced: publish extra messages) |
| `log(level, msg)` | write to `agent_logs` (shows in the Logs tab): `info`/`warning`/`error` |

---

## 7. Message envelope (what flows on the bus)
```json
{
  "run_id": "uuid",
  "system_id": "uuid",
  "from_agent": "researcher",
  "timestamp": "2026-06-15T08:00:00.000Z",
  "payload": "text or JSON-stringified",
  "metadata": {}
}
```
`run_id` is generated by the backend on Run and propagates through the whole
pipeline — it's the coordination key for fan-in and for grouping logs/events.

---

## 8. Project layout
| Path | Role |
|---|---|
| `core/` | Python SDK + universal `daemon.py` |
| `server/` | Express, WebSocket, NATS monitor, process manager, routes |
| `server/agent-files.js` | compiles the graph → `agent.yaml` + `runner.py` on disk |
| `client/` | React + React Flow + Zustand UI |
| `agents/<id>/` | generated agent folders |
| `systems/<id>.json` | saved system graphs |
| `data/studio.db` | SQLite: systems, agents, runs, events, agent_logs |
| `data/jetstream/` | NATS JetStream store |

## 9. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Run stays "running", no result | Missing/invalid API key, or agent error → check **Logs tab** |
| Agent badge never turns green | `python3` or a Python dep missing → check terminal running `npm start` |
| `nats-server not found` | `brew install nats-server` (or drop a binary in `nats-bin/`) |
| Edits to `runner.py` vanished | (Fixed) files are now scaffold-once; pull latest |
| Port already in use | `lsof -ti:3001 | xargs kill` |

# Multi-Agent Studio

Local GUI to build, visualize, and run multi-agent systems. Agents talk over
NATS JetStream, everything is logged to SQLite, and any system exports to a
self-contained ZIP.

## Requirements
- Node.js 20+
- Python 3.11+
- nats-server on PATH (`brew install nats-server`) — already detected here

## Setup
```bash
cp .env.example .env          # add OPENAI_API_KEY / ANTHROPIC_API_KEY
npm install
cd client && npm install && cd ..
pip install -r requirements.txt   # also attempted by bootstrap
```

## Run
```bash
npm run build      # build the React client (prod)
npm start          # boots NATS + SQLite + Express + serves UI on :3001
# or for live frontend:
npm run dev        # Express :3001 proxies Vite :5173 (run `cd client && npm run dev` too)
```
UI: http://localhost:3001

## Smoke test
```bash
node scripts/e2e-check.js   # builds a 3-agent pipeline and verifies plumbing
                            # (with OPENAI_API_KEY set, also asserts a real result)
```

## Agent types
- `llm_worker` — input → LLM → output
- `langgraph`  — ReAct agent (graph.py)
- `python`     — arbitrary `async handle(input, context)` (Monaco editor)

## Layout
- `core/`    Python SDK + universal daemon
- `server/`  Express + WS + NATS monitor + process manager + routes
- `client/`  React + React Flow + Zustand UI
- `agents/`  generated agent folders (agent.yaml + runner.py)
- `systems/` saved system graphs
- `data/`    SQLite db + JetStream store

## How it works
1. Draw a graph; each edge `A→B` auto-creates subject `agent.A.output`.
2. "Start agents" spawns one Python daemon per node (subscribes on NATS).
3. "Run" injects input at entry nodes with a shared `run_id`; messages cascade.
4. Fan-in nodes wait for all sources (by `run_id`) before firing.
5. WS streams status/messages/results live to the UI.

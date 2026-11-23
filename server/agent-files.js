// Compile a system graph (nodes + edges) into on-disk agent folders.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const AGENTS_DIR = path.join(ROOT, 'agents');

function outSubject(id) { return `agent.${id}.output`; }
function inSubject(id) { return `agent.${id}.input`; }

function agentType(node) { return (node.data && node.data.agentType) || 'llm_worker'; }

// Derive subscribe/publish subjects + entry/terminal flags for each node.
// User nodes are purely visual and must be pre-filtered before calling this.
// Orchestrator → Worker edges are tool-call relationships (not NATS pub/sub).
function deriveTopology(nodes, edges) {
  const orchestratorIds = new Set(nodes.filter((n) => agentType(n) === 'orchestrator').map((n) => n.id));

  // Build NATS-level adjacency (excludes orchestrator→worker tool-call edges)
  const incoming = {}; // id -> [srcId]
  const outgoing = {}; // id -> [tgtId]
  const workerMap = {}; // orchestratorId -> [workerId]

  for (const n of nodes) { incoming[n.id] = []; outgoing[n.id] = []; }
  for (const oid of orchestratorIds) workerMap[oid] = [];

  for (const e of edges) {
    if (!outgoing[e.source]) continue; // source not in nodes (e.g. user edge already filtered)
    if (orchestratorIds.has(e.source)) {
      // tool-call edge: add to workers list, not NATS graph
      workerMap[e.source].push(e.target);
    } else {
      outgoing[e.source].push(e.target);
      if (incoming[e.target]) incoming[e.target].push(e.source);
    }
  }

  // Sub-agents are targets of orchestrator tool-call edges; they have no NATS subscriptions
  const subagentIds = new Set(Object.values(workerMap).flat());

  const topo = {};
  for (const n of nodes) {
    const inc = incoming[n.id];
    const out = outgoing[n.id];
    const isOrch = orchestratorIds.has(n.id);
    const isSub = subagentIds.has(n.id);

    const subscribes = isSub ? [] : inc.length ? inc.map(outSubject) : [inSubject(n.id)];
    const publishes  = (isSub || isOrch) ? [] : out.length ? [outSubject(n.id)] : [];

    topo[n.id] = {
      subscribes,
      publishes,
      entry:    !isSub && inc.length === 0,
      terminal: isSub || isOrch || out.length === 0,
      sources:  inc.length,
      workers:  workerMap[n.id] || [],
      subagent: isSub,
    };
  }
  return topo;
}

const ORCHESTRATOR_RUNNER = `import asyncio, importlib.util, os
import yaml as _yaml


async def _call_worker(worker_id: str, input_text: str, context: dict) -> str:
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    worker_dir = os.path.join(base, worker_id)
    with open(os.path.join(worker_dir, 'agent.yaml')) as f:
        worker_cfg = _yaml.safe_load(f)
    spec = importlib.util.spec_from_file_location(
        f'worker_{worker_id}', os.path.join(worker_dir, 'runner.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    child_ctx = {**context, 'config': worker_cfg, 'agent_id': worker_id}
    return await mod.handle(input_text, child_ctx)


async def handle(input_text: str, context: dict) -> str:
    cfg = context["config"]
    workers = cfg.get("workers", [])
    llm_cfg = cfg.get("llm", {})
    provider = llm_cfg.get("provider", "openai")
    model = llm_cfg.get("model", "gpt-4o")
    temperature = llm_cfg.get("temperature", 0.7)
    system_prompt = llm_cfg.get("system_prompt",
        "You are a helpful manager. Synthesize your team's reports into a clear, concise answer.")

    # Call all workers in parallel (tool calls)
    if workers:
        context["log"]("info", f"Dispatching to workers: {workers}")
        raw = await asyncio.gather(
            *[_call_worker(w, input_text, context) for w in workers],
            return_exceptions=True)
        reports = {}
        for w, r in zip(workers, raw):
            reports[w] = str(r) if isinstance(r, Exception) else r
            context["log"]("info", f"{w}: {reports[w][:120]}")
        combined = f"User request: {input_text}\\n\\n"
        for w_id, w_res in reports.items():
            combined += f"--- Report from {w_id} ---\\n{w_res}\\n\\n"
        final_input = combined
    else:
        final_input = input_text

    if provider == "anthropic":
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic()
        resp = await client.messages.create(
            model=model, max_tokens=2048, temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": final_input}])
        return resp.content[0].text

    if provider == "mistral":
        from mistralai.client import Mistral
        client = Mistral()
        resp = await client.chat.complete_async(
            model=model, temperature=temperature,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": final_input}])
        return resp.choices[0].message.content

    from openai import AsyncOpenAI
    client = AsyncOpenAI()
    resp = await client.chat.completions.create(
        model=model, temperature=temperature,
        messages=[{"role": "system", "content": system_prompt},
                  {"role": "user", "content": final_input}])
    return resp.choices[0].message.content
`;

const LLM_RUNNER = `from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from mistralai.client import Mistral


async def handle(input_text: str, context: dict) -> str:
    cfg = context["config"].get("llm", {})
    provider = cfg.get("provider", "openai")
    system_prompt = cfg.get("system_prompt", "You are a helpful assistant.")
    model = cfg.get("model", "gpt-4o")
    temperature = cfg.get("temperature", 0.7)

    if provider == "anthropic":
        client = AsyncAnthropic()
        resp = await client.messages.create(
            model=model,
            max_tokens=2048,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": input_text}],
        )
        return resp.content[0].text

    if provider == "mistral":
        client = Mistral()
        resp = await client.chat.complete_async(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": input_text},
            ],
        )
        return resp.choices[0].message.content

    client = AsyncOpenAI()
    resp = await client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": input_text},
        ],
    )
    return resp.choices[0].message.content
`;

const LANGGRAPH_RUNNER = `from .graph import build_graph


async def handle(input_text: str, context: dict) -> str:
    graph = build_graph(context["config"])
    result = await graph.ainvoke({"messages": [("human", input_text)]})
    return result["messages"][-1].content
`;

const LANGGRAPH_GRAPH = `import importlib.util, os
from langgraph.prebuilt import create_react_agent


def _build_model(cfg: dict):
    provider = cfg.get("provider", "openai")
    model = cfg.get("model", "gpt-4o")
    temperature = cfg.get("temperature", 0.7)
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model, temperature=temperature)
    if provider == "mistral":
        from langchain_mistralai import ChatMistralAI
        return ChatMistralAI(model=model, temperature=temperature)
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model=model, temperature=temperature)


def _load_tools(tool_names: list) -> list:
    tools_dir = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', '..', 'tools'))
    loaded = []
    for name in tool_names:
        p = os.path.join(tools_dir, f'{name}.py')
        if not os.path.exists(p):
            continue
        spec = importlib.util.spec_from_file_location(name, p)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for attr in dir(mod):
            obj = getattr(mod, attr)
            if callable(obj) and hasattr(obj, 'name') and hasattr(obj, 'description'):
                loaded.append(obj)
    return loaded


def build_graph(config: dict):
    cfg = config.get("llm", {})
    model = _build_model(cfg)
    tools = _load_tools(config.get("tools", []))
    return create_react_agent(model, tools)
`;

const PYTHON_RUNNER_DEFAULT = `import json


async def handle(input_text: str, context: dict) -> str:
    # Edit me in the Agent panel.
    return input_text
`;

function buildYaml(node, topo) {
  const d = node.data || {};
  const t = topo[node.id];
  const type = d.agentType || 'llm_worker';
  const doc = {
    id: node.id,
    name: d.name || node.id,
    type,
    description: d.description || '',
    subscribes: t.subscribes,
    publishes: t.publishes,
    fan_in: { require_all: !!(d.fan_in && t.sources > 1) },
    timeout_seconds: d.timeout_seconds || 120,
    subagent: !!t.subagent,
  };
  if (type === 'llm_worker' || type === 'langgraph' || type === 'orchestrator') {
    doc.llm = {
      provider: (d.llm && d.llm.provider) || 'openai',
      model: (d.llm && d.llm.model) || (type === 'orchestrator' ? 'gpt-4o' : 'gpt-4o-mini'),
      temperature: (d.llm && d.llm.temperature) != null ? d.llm.temperature : 0.7,
      system_prompt: (d.llm && d.llm.system_prompt) || 'You are a helpful assistant.',
    };
    if (type === 'langgraph') doc.tools = d.tools || [];
    if (type === 'orchestrator') doc.workers = t.workers || [];
  }
  return doc;
}

// Scaffold code files ONLY when missing, so manual / Monaco edits survive
// graph re-saves. agent.yaml (written separately) always carries fresh config,
// and runner.py reads it at runtime — so prompt/model changes still take effect.
function writeRunner(dir, type, node) {
  const runnerPath = path.join(dir, 'runner.py');
  const writeIfMissing = (p, content) => {
    if (!fs.existsSync(p)) fs.writeFileSync(p, content);
  };
  if (type === 'user') {
    return; // purely visual node, no code
  } else if (type === 'orchestrator') {
    fs.writeFileSync(runnerPath, ORCHESTRATOR_RUNNER);
  } else if (type === 'python') {
    const code = (node.data && node.data.code) || PYTHON_RUNNER_DEFAULT;
    writeIfMissing(runnerPath, code);
  } else if (type === 'langgraph') {
    writeIfMissing(runnerPath, LANGGRAPH_RUNNER);
    writeIfMissing(path.join(dir, 'graph.py'), LANGGRAPH_GRAPH);
  } else {
    // llm_worker runner.py is fully generated — always overwrite so provider changes take effect
    fs.writeFileSync(runnerPath, LLM_RUNNER);
  }
  // package marker for relative import in langgraph
  fs.writeFileSync(path.join(dir, '__init__.py'), '');
}

// Compile whole system to disk. Returns topo map.
function compileSystem(config) {
  // User nodes are purely visual — filter before topology computation
  const nodes = (config.nodes || []).filter((n) => agentType(n) !== 'user');
  const edges = config.edges || [];
  const topo = deriveTopology(nodes, edges);
  for (const node of nodes) {
    const dir = path.join(AGENTS_DIR, node.id);
    fs.mkdirSync(dir, { recursive: true });
    const type = (node.data && node.data.agentType) || 'llm_worker';
    const doc = buildYaml(node, topo);
    fs.writeFileSync(path.join(dir, 'agent.yaml'), yaml.dump(doc));
    writeRunner(dir, type, node);
  }
  return topo;
}

function agentDir(id) { return path.join(AGENTS_DIR, id); }

module.exports = { compileSystem, deriveTopology, agentDir, outSubject, inSubject };

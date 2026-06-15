// Compile a system graph (nodes + edges) into on-disk agent folders.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const AGENTS_DIR = path.join(ROOT, 'agents');

function outSubject(id) { return `agent.${id}.output`; }
function inSubject(id) { return `agent.${id}.input`; }

// Derive subscribe/publish subjects + entry/terminal flags for each node.
function deriveTopology(nodes, edges) {
  const incoming = {}; // id -> [srcId]
  const outgoing = {}; // id -> [tgtId]
  for (const n of nodes) { incoming[n.id] = []; outgoing[n.id] = []; }
  for (const e of edges) {
    if (outgoing[e.source]) outgoing[e.source].push(e.target);
    if (incoming[e.target]) incoming[e.target].push(e.source);
  }
  const topo = {};
  for (const n of nodes) {
    const inc = incoming[n.id];
    const out = outgoing[n.id];
    const subscribes = inc.length ? inc.map(outSubject) : [inSubject(n.id)];
    const publishes = out.length ? [outSubject(n.id)] : [];
    topo[n.id] = {
      subscribes,
      publishes,
      entry: inc.length === 0,
      terminal: out.length === 0,
      sources: inc.length,
    };
  }
  return topo;
}

const LLM_RUNNER = `from openai import AsyncOpenAI
from anthropic import AsyncAnthropic


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

const LANGGRAPH_GRAPH = `from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent


def build_graph(config: dict):
    cfg = config.get("llm", {})
    model = ChatOpenAI(model=cfg.get("model", "gpt-4o"),
                       temperature=cfg.get("temperature", 0.7))
    tools = []  # tools wired here based on config["tools"]
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
  const doc = {
    id: node.id,
    name: d.name || node.id,
    type: d.agentType || 'llm_worker',
    description: d.description || '',
    subscribes: t.subscribes,
    publishes: t.publishes,
    fan_in: { require_all: !!(d.fan_in && t.sources > 1) },
    timeout_seconds: d.timeout_seconds || 120,
  };
  if (doc.type === 'llm_worker' || doc.type === 'langgraph') {
    doc.llm = {
      provider: (d.llm && d.llm.provider) || 'openai',
      model: (d.llm && d.llm.model) || 'gpt-4o',
      temperature: (d.llm && d.llm.temperature) != null ? d.llm.temperature : 0.7,
      system_prompt: (d.llm && d.llm.system_prompt) || 'You are a helpful assistant.',
    };
    if (doc.type === 'langgraph') doc.tools = d.tools || [];
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
  if (type === 'python') {
    const code = (node.data && node.data.code) || PYTHON_RUNNER_DEFAULT;
    writeIfMissing(runnerPath, code);
  } else if (type === 'langgraph') {
    writeIfMissing(runnerPath, LANGGRAPH_RUNNER);
    writeIfMissing(path.join(dir, 'graph.py'), LANGGRAPH_GRAPH);
  } else {
    writeIfMissing(runnerPath, LLM_RUNNER);
  }
  // package marker for relative import in langgraph
  fs.writeFileSync(path.join(dir, '__init__.py'), '');
}

// Compile whole system to disk. Returns topo map.
function compileSystem(config) {
  const nodes = config.nodes || [];
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

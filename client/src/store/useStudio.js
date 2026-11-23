import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';

const API = '/api';

async function jget(url) { const r = await fetch(API + url); return r.json(); }
async function jsend(method, url, body) {
  const r = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

let saveTimer = null;

export const useStudio = create((set, get) => ({
  systems: [],
  activeSystemId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  agentStatuses: {},
  runs: [],
  activeRunId: null,
  finalResult: '',
  natsMessages: [],
  ws: null,

  // ---- systems ----
  loadSystems: async () => set({ systems: await jget('/systems') }),

  createSystem: async (name) => {
    const sys = await jsend('POST', '/systems', { name });
    await get().loadSystems();
    get().openSystem(sys.id);
    return sys;
  },

  deleteSystem: async (id) => {
    await jsend('DELETE', `/systems/${id}`);
    if (get().activeSystemId === id) set({ activeSystemId: null, nodes: [], edges: [] });
    await get().loadSystems();
  },

  openSystem: async (id) => {
    const sys = await jget(`/systems/${id}`);
    const cfg = JSON.parse(sys.config);
    set({
      activeSystemId: id,
      nodes: cfg.nodes || [],
      edges: cfg.edges || [],
      selectedNodeId: null,
      finalResult: '',
    });
    get().loadRuns();
  },

  // ---- graph ----
  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (conn) => { set({ edges: addEdge({ ...conn, animated: false }, get().edges) }); get().save(); },

  addNode: (agentType, position) => {
    const id = `${agentType}_${Math.random().toString(36).slice(2, 7)}`;
    const node = {
      id,
      type: 'agent',
      position,
      data: {
        name: id,
        agentType,
        description: '',
        timeout_seconds: 120,
        fan_in: false,
        llm: { provider: 'openai', model: 'gpt-4o', temperature: 0.7, system_prompt: 'You are a helpful assistant.' },
        tools: [],
      },
    };
    set({ nodes: [...get().nodes, node], selectedNodeId: id });
    get().save();
  },

  loadExample: async () => {
    const node = (id, agentType, name, x, y, extra = {}) => ({   // company analysis pipeline
      id,
      type: 'agent',
      position: { x, y },
      data: {
        name,
        agentType,
        description: '',
        timeout_seconds: 120,
        fan_in: false,
        llm: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.7, system_prompt: 'You are a helpful assistant.' },
        tools: [],
        ...extra,
      },
    });

    const nodes = [
      node('user', 'user', 'You', 60, 250),
      node('director', 'orchestrator', 'Research Director', 300, 250, {
        llm: {
          provider: 'openai', model: 'gpt-4o', temperature: 0.4,
          system_prompt: 'You are a research director. You receive a company name and parallel reports from your team of analysts. Synthesize their insights into a clear, structured company analysis: executive summary, business model, key risks, and market position. Be concise and direct.',
        },
      }),
      node('financial', 'llm_worker', 'Financial Analyst', 600, 80, {
        llm: {
          provider: 'openai', model: 'gpt-4o-mini', temperature: 0.4,
          system_prompt: 'You are a financial analyst. Given a company name, analyze its business model and revenue streams in 3-4 bullet points. Focus on what makes it financially strong or vulnerable. Be specific, under 150 words.',
        },
      }),
      node('risk', 'llm_worker', 'Risk Analyst', 600, 250, {
        llm: {
          provider: 'openai', model: 'gpt-4o-mini', temperature: 0.4,
          system_prompt: 'You are a risk analyst. Given a company name, identify the top 3 risks: competitive threats, market risks, and operational vulnerabilities. Each in one sentence. Under 100 words.',
        },
      }),
      node('market', 'llm_worker', 'Market Analyst', 600, 420, {
        llm: {
          provider: 'openai', model: 'gpt-4o-mini', temperature: 0.4,
          system_prompt: 'You are a market analyst. Given a company name, describe its market position, main competitors, and one key growth opportunity. Under 120 words.',
        },
      }),
    ];

    const edges = [
      { id: 'e1', source: 'user',      target: 'director'  },
      { id: 'e2', source: 'director',  target: 'financial' },
      { id: 'e3', source: 'director',  target: 'risk'      },
      { id: 'e4', source: 'director',  target: 'market'    },
    ];

    const sys = await jsend('POST', '/systems', { name: 'Company Analysis (example)' });
    await jsend('PATCH', `/systems/${sys.id}`, { config: { nodes, edges } });
    await get().loadSystems();
    get().openSystem(sys.id);
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeData: (id, patch) => {
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    });
    get().save();
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: null,
    });
    get().save();
  },

  // debounced save of whole graph
  save: () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const { activeSystemId, nodes, edges } = get();
      if (!activeSystemId) return;
      await jsend('PATCH', `/systems/${activeSystemId}`, { config: { nodes, edges } });
    }, 500);
  },

  // ---- agents lifecycle ----
  startAgents: async () => {
    const id = get().activeSystemId;
    if (!id) return;
    await jsend('POST', `/systems/${id}/start`);
  },
  stopAgents: async () => {
    const id = get().activeSystemId;
    if (!id) return;
    await jsend('POST', `/systems/${id}/stop`);
    set({ agentStatuses: {} });
  },

  // ---- runs ----
  loadRuns: async () => {
    const id = get().activeSystemId;
    if (!id) return;
    set({ runs: await jget(`/runs/${id}/list`) });
  },
  startRun: async (input) => {
    const id = get().activeSystemId;
    if (!id) return;
    set({ finalResult: '' });
    const r = await jsend('POST', '/runs', { system_id: id, input });
    set({ activeRunId: r.run_id });
    get().loadRuns();
    return r;
  },

  // ---- websocket ----
  connectWs: () => {
    if (get().ws) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}`);
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      const s = get();
      if (m.type === 'agent_status') {
        set({ agentStatuses: { ...s.agentStatuses, [m.agentId]: m.status } });
      } else if (m.type === 'nats_message') {
        const buf = [...s.natsMessages, { ...m, ts: Date.now() }].slice(-200);
        set({ natsMessages: buf });
        // pulse the node
        get().pulseNode(m.envelope && m.envelope.from_agent);
      } else if (m.type === 'agent_recv') {
        get().pulseNode(m.agentId);
      } else if (m.type === 'agent_final') {
        if (m.run_id === get().activeRunId) set({ finalResult: m.output });
        get().loadRuns();
      } else if (m.type === 'agent_error') {
        if (m.run_id === get().activeRunId) set({ finalResult: `ERROR: ${m.error}` });
        get().loadRuns();
      }
    };
    ws.onclose = () => set({ ws: null });
    set({ ws });
  },

  activePulses: {},
  pulseNode: (agentId) => {
    if (!agentId) return;
    set({ activePulses: { ...get().activePulses, [agentId]: Date.now() } });
    setTimeout(() => {
      const p = { ...get().activePulses };
      delete p[agentId];
      set({ activePulses: p });
    }, 1000);
  },
}));

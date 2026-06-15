CREATE TABLE IF NOT EXISTS systems (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  config     TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id         TEXT PRIMARY KEY,
  system_id  TEXT REFERENCES systems(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  config     TEXT NOT NULL,
  pos_x      REAL DEFAULT 0,
  pos_y      REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  system_id    TEXT REFERENCES systems(id),
  input        TEXT NOT NULL,
  status       TEXT DEFAULT 'running',
  result       TEXT,
  started_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      TEXT REFERENCES runs(id),
  from_agent  TEXT,
  to_subject  TEXT,
  payload     TEXT,
  ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id    TEXT,
  agent_id  TEXT,
  level     TEXT,
  message   TEXT,
  ts        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_logs_run ON agent_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_agents_system ON agents(system_id);

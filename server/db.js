const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'studio.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

const q = {
  // systems
  listSystems: db.prepare('SELECT * FROM systems ORDER BY updated_at DESC'),
  getSystem: db.prepare('SELECT * FROM systems WHERE id = ?'),
  insertSystem: db.prepare('INSERT INTO systems (id, name, config) VALUES (?, ?, ?)'),
  updateSystem: db.prepare(
    "UPDATE systems SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ),
  deleteSystem: db.prepare('DELETE FROM systems WHERE id = ?'),

  // agents
  listAgents: db.prepare('SELECT * FROM agents WHERE system_id = ?'),
  getAgent: db.prepare('SELECT * FROM agents WHERE id = ?'),
  upsertAgent: db.prepare(`
    INSERT INTO agents (id, system_id, name, type, config, pos_x, pos_y)
    VALUES (@id, @system_id, @name, @type, @config, @pos_x, @pos_y)
    ON CONFLICT(id) DO UPDATE SET
      name=@name, type=@type, config=@config, pos_x=@pos_x, pos_y=@pos_y`),
  deleteAgent: db.prepare('DELETE FROM agents WHERE id = ?'),
  deleteAgentsBySystem: db.prepare('DELETE FROM agents WHERE system_id = ?'),

  // runs
  insertRun: db.prepare('INSERT INTO runs (id, system_id, input) VALUES (?, ?, ?)'),
  getRun: db.prepare('SELECT * FROM runs WHERE id = ?'),
  listRuns: db.prepare('SELECT * FROM runs WHERE system_id = ? ORDER BY started_at DESC'),
  completeRun: db.prepare(
    "UPDATE runs SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
  ),
  staleRuns: db.prepare(
    "SELECT * FROM runs WHERE status = 'running' AND started_at <= datetime('now', ?)"
  ),

  // events / logs
  eventsByRun: db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY id ASC'),
  logsByRun: db.prepare('SELECT * FROM agent_logs WHERE run_id = ? ORDER BY id ASC'),

  // single run
  getRun: db.prepare('SELECT * FROM runs WHERE id = ?'),

  // test cases
  listTests:   db.prepare('SELECT * FROM test_cases WHERE system_id = ? ORDER BY created_at ASC'),
  insertTest:  db.prepare('INSERT INTO test_cases (id, system_id, name, input, expected) VALUES (?, ?, ?, ?, ?)'),
  deleteTest:  db.prepare('DELETE FROM test_cases WHERE id = ?'),

  // stats
  runSummary: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'running'   THEN 1 ELSE 0 END) as running,
      ROUND(AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL
        THEN (JULIANDAY(completed_at) - JULIANDAY(started_at)) * 86400000
        ELSE NULL END)) as avg_duration_ms
    FROM runs WHERE system_id = ?`),

  errorCount: db.prepare(`
    SELECT COUNT(*) as count FROM agent_logs
    WHERE level = 'error'
      AND run_id IN (SELECT id FROM runs WHERE system_id = ?)`),

  recentRuns: db.prepare(`
    SELECT id, status, input, started_at, completed_at,
      ROUND((JULIANDAY(completed_at) - JULIANDAY(started_at)) * 86400000) as duration_ms
    FROM runs WHERE system_id = ?
    ORDER BY started_at DESC LIMIT 15`),

  agentActivity: db.prepare(`
    SELECT from_agent, COUNT(*) as msg_count
    FROM events
    WHERE from_agent != '__user__'
      AND run_id IN (SELECT id FROM runs WHERE system_id = ?)
    GROUP BY from_agent ORDER BY msg_count DESC`),
};

module.exports = { db, q };

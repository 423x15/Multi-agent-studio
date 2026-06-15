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
};

module.exports = { db, q };

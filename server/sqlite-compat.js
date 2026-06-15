// Drop-in replacement for better-sqlite3 using node-sqlite3-wasm (no native compilation).
// Translates better-sqlite3 API conventions to node-sqlite3-wasm:
//   - @name params in SQL -> :name
//   - { name: val } objects -> { ':name': val }
//   - spread positional args -> array
const { Database: WasmDB } = require('node-sqlite3-wasm');

function normalizeSql(sql) {
  return sql.replace(/@(\w+)/g, ':$1');
}

function normalizeParams(args) {
  if (args.length === 0) return [];
  const first = args[0];
  if (args.length === 1 && first !== null && typeof first === 'object' && !Array.isArray(first)) {
    const result = {};
    for (const [k, v] of Object.entries(first)) {
      const key = (k[0] === ':' || k[0] === '@' || k[0] === '$') ? k : `:${k}`;
      result[key] = v;
    }
    return result;
  }
  return args; // array of positional values
}

class Statement {
  constructor(stmt) { this._s = stmt; }
  run(...args) { return this._s.run(normalizeParams(args)); }
  get(...args) { return this._s.get(normalizeParams(args)); }
  all(...args) { return this._s.all(normalizeParams(args)); }
}

class Database {
  constructor(path) { this._db = new WasmDB(path); }
  pragma(str) { this._db.exec(`PRAGMA ${str}`); }
  exec(sql) { return this._db.exec(sql); }
  prepare(sql) { return new Statement(this._db.prepare(normalizeSql(sql))); }
  close() { return this._db.close(); }
}

module.exports = Database;

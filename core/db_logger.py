import sqlite3, os

DB_PATH = os.environ.get("SQLITE_PATH", "./data/studio.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def log_event(run_id: str, from_agent: str, to_subject: str, payload: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO events (run_id, from_agent, to_subject, payload) VALUES (?, ?, ?, ?)",
            (run_id, from_agent, to_subject, payload),
        )


def log_agent(run_id: str, agent_id: str, level: str, message: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO agent_logs (run_id, agent_id, level, message) VALUES (?, ?, ?, ?)",
            (run_id, agent_id, level, message),
        )

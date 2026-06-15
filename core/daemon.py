import asyncio, os, sys, json, re, importlib.util
from pathlib import Path

import yaml
import nats

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core.message import MessageEnvelope
from core.db_logger import log_event, log_agent
from core.fan_in_buffer import FanInBuffer


def emit(obj: dict):
    """Structured line on stdout -> Node process-manager -> WebSocket."""
    print("@@JSON@@" + json.dumps(obj), flush=True)


def _durable(agent_id: str, subject: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9]", "_", subject)
    return f"{agent_id}__{safe}"


async def main(agent_path: str):
    config = yaml.safe_load(Path(agent_path, "agent.yaml").read_text())
    agent_id = config["id"]
    system_id = os.environ.get("SYSTEM_ID", "")
    nats_url = os.environ.get("NATS_URL", "nats://localhost:4222")
    subscribes = config.get("subscribes", []) or []
    publishes = config.get("publishes", []) or []

    # Load runner.py dynamically
    spec = importlib.util.spec_from_file_location(
        f"runner_{agent_id}", Path(agent_path, "runner.py")
    )
    runner = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = runner
    spec.loader.exec_module(runner)

    nc = await nats.connect(nats_url, max_reconnect_attempts=-1)
    js = nc.jetstream()

    fan_in = None
    if config.get("fan_in", {}).get("require_all") and len(subscribes) > 1:
        fan_in = FanInBuffer(set(subscribes))

    async def on_message(msg):
        try:
            await msg.ack()
        except Exception:
            pass
        envelope = MessageEnvelope.from_json(msg.data)
        log_event(envelope.run_id, agent_id, msg.subject, envelope.payload)
        emit({"type": "agent_recv", "agentId": agent_id, "run_id": envelope.run_id,
              "subject": msg.subject})

        if fan_in:
            collected = await fan_in.receive(envelope.run_id, msg.subject, envelope.payload)
            if collected is None:
                return
            input_data = json.dumps(collected)
        else:
            input_data = envelope.payload

        context = {
            "run_id": envelope.run_id,
            "system_id": system_id,
            "agent_id": agent_id,
            "config": config,
            "js": js,
            "log": lambda level, m: log_agent(envelope.run_id, agent_id, level, m),
        }

        try:
            log_agent(envelope.run_id, agent_id, "info", "Starting processing")
            output = await runner.handle(input_data, context)
            log_agent(envelope.run_id, agent_id, "info", "Processing complete")
        except Exception as e:
            log_agent(envelope.run_id, agent_id, "error", str(e))
            emit({"type": "agent_error", "agentId": agent_id,
                  "run_id": envelope.run_id, "error": str(e)})
            return

        out = MessageEnvelope(
            run_id=envelope.run_id, system_id=system_id,
            from_agent=agent_id, payload=output,
        )
        for subject in publishes:
            await js.publish(subject, out.to_json())
            log_event(envelope.run_id, agent_id, subject, output)

        # Terminal agent (no outgoing) -> signal final result
        if not publishes:
            emit({"type": "agent_final", "agentId": agent_id,
                  "run_id": envelope.run_id, "output": output})

    for subject in subscribes:
        await js.subscribe(subject, durable=_durable(agent_id, subject), cb=on_message)

    log_agent("", agent_id, "info", f"listening on {subscribes}")
    print(f"[{agent_id}] READY", flush=True)
    emit({"type": "agent_status", "agentId": agent_id, "status": "running"})

    await asyncio.Event().wait()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--agent", required=True)
    args = p.parse_args()
    try:
        asyncio.run(main(args.agent))
    except KeyboardInterrupt:
        pass

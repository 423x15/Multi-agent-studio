from dataclasses import dataclass, field
from typing import Any, Dict
import json, datetime


@dataclass
class MessageEnvelope:
    run_id: str
    system_id: str
    from_agent: str
    payload: str
    timestamp: str = field(
        default_factory=lambda: datetime.datetime.utcnow().isoformat() + "Z"
    )
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> bytes:
        return json.dumps(self.__dict__).encode()

    @staticmethod
    def from_json(data: bytes) -> "MessageEnvelope":
        d = json.loads(data)
        # tolerate extra/missing keys
        allowed = {"run_id", "system_id", "from_agent", "payload", "timestamp", "metadata"}
        clean = {k: v for k, v in d.items() if k in allowed}
        clean.setdefault("system_id", "")
        clean.setdefault("from_agent", "")
        clean.setdefault("payload", "")
        clean.setdefault("metadata", {})
        return MessageEnvelope(**clean)

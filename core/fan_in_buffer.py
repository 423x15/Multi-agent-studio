from typing import Dict, Set, Optional
import asyncio


class FanInBuffer:
    """Accumulate messages by run_id until one from every required subject
    has arrived, then return the collected dict {subject: payload}."""

    def __init__(self, required_subjects: Set[str]):
        self.required = set(required_subjects)
        self._buffer: Dict[str, Dict[str, str]] = {}
        self._lock = asyncio.Lock()

    async def receive(self, run_id: str, subject: str, payload: str) -> Optional[Dict[str, str]]:
        async with self._lock:
            self._buffer.setdefault(run_id, {})[subject] = payload
            if set(self._buffer[run_id].keys()) >= self.required:
                return self._buffer.pop(run_id)
        return None

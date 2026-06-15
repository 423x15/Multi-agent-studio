from abc import ABC, abstractmethod


class BaseRunner(ABC):
    @abstractmethod
    async def handle(self, input_text: str, context: dict) -> str:
        ...

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent


def build_graph(config: dict):
    cfg = config.get("llm", {})
    model = ChatOpenAI(model=cfg.get("model", "gpt-4o"),
                       temperature=cfg.get("temperature", 0.7))
    tools = []  # tools wired here based on config["tools"]
    return create_react_agent(model, tools)

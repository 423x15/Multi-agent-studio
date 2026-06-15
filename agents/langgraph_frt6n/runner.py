from .graph import build_graph


async def handle(input_text: str, context: dict) -> str:
    graph = build_graph(context["config"])
    result = await graph.ainvoke({"messages": [("human", input_text)]})
    return result["messages"][-1].content

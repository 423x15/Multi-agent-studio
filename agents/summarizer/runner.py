from openai import AsyncOpenAI
from anthropic import AsyncAnthropic


async def handle(input_text: str, context: dict) -> str:
    cfg = context["config"].get("llm", {})
    provider = cfg.get("provider", "openai")
    system_prompt = cfg.get("system_prompt", "You are a helpful assistant.")
    model = cfg.get("model", "gpt-4o")
    temperature = cfg.get("temperature", 0.7)

    if provider == "anthropic":
        client = AsyncAnthropic()
        resp = await client.messages.create(
            model=model,
            max_tokens=2048,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": input_text}],
        )
        return resp.content[0].text

    client = AsyncOpenAI()
    resp = await client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": input_text},
        ],
    )
    return resp.choices[0].message.content

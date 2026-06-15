import nats


async def connect(nats_url: str):
    """Connect and return (nc, js)."""
    nc = await nats.connect(nats_url, max_reconnect_attempts=-1)
    js = nc.jetstream()
    return nc, js

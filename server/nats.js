const { connect, StringCodec, consumerOpts, createInbox } = require('nats');
const { broadcast } = require('./ws-broadcaster');

let nc = null;
let js = null;
const sc = StringCodec();
const STREAM = 'AGENTS';

async function connectNATS() {
  nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
  const jsm = await nc.jetstreamManager();
  try {
    await jsm.streams.add({ name: STREAM, subjects: ['agent.>'] });
    console.log('[nats] stream AGENTS created');
  } catch (e) {
    try { await jsm.streams.update(STREAM, { subjects: ['agent.>'] }); } catch (_) {}
    console.log('[nats] stream AGENTS ready');
  }
  js = nc.jetstream();

  // Monitor every message on the bus via ephemeral push consumer.
  const opts = consumerOpts();
  opts.deliverTo(createInbox());
  opts.deliverNew();
  opts.ackNone();
  const sub = await js.subscribe('agent.>', opts);
  (async () => {
    for await (const msg of sub) {
      try {
        const envelope = JSON.parse(sc.decode(msg.data));
        broadcast({ type: 'nats_message', subject: msg.subject, envelope });
      } catch (_) {}
    }
  })();
  console.log('[nats] monitoring agent.>');
}

async function publishRunInput(subject, envelope) {
  if (!js) throw new Error('NATS not connected');
  await js.publish(subject, Buffer.from(JSON.stringify(envelope)));
}

module.exports = { connectNATS, publishRunInput };

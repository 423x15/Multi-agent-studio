const { WebSocketServer } = require('ws');
const { EventEmitter } = require('events');

let wss = null;
const bus = new EventEmitter();

function initWebSocket(server) {
  wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }));
  });
  return wss;
}

function broadcast(obj) {
  bus.emit('event', obj);
  if (obj && obj.type) bus.emit(obj.type, obj);
  if (!wss) return;
  const data = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

module.exports = { initWebSocket, broadcast, bus };

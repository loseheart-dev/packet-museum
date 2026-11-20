import { concat, ethernet, ipv4, udp, uint } from '../../lib/bytes/index.js';
import { contents, summaries } from './copy.js';
import { inspectQUIC } from './parse.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', web: '203.0.113.10' };
const path = ['client', 'router', 'internet', 'web'];
const macs = ['00:00:5e:00:53:10', '00:00:5e:00:53:01'];
const [firstCID, clientCID, serverCID] = [
  Uint8Array.of(91, 158, 65, 7, 194, 56, 175, 22), Uint8Array.of(138, 47, 96, 212, 19, 126, 149, 177),
  Uint8Array.of(62, 199, 82, 9, 248, 106, 33, 212),
];
const cid = bytes => concat(uint(bytes.length, 1), bytes);

function packetBytes({ type, sealed }, server, sample) {
  const dcid = server ? clientCID : sample < 2 ? firstCID : serverCID;
  const protectedBytes = Uint8Array.from({ length: sealed + 1 }, (_, i) => (i * 73 + (i >>> 3) * 29 + sample * 47 + 91) & 255);
  const initial = type === 'Initial';
  if (type === '1-RTT') return concat(uint(0x52, 1), dcid, protectedBytes);
  const ids = concat(cid(dcid), cid(server ? serverCID : clientCID));
  const lengths = initial ? concat(uint(0, 1), uint(0x4000 | (sealed + 1), 2)) : uint(0x4000 | (sealed + 1), 2);
  return concat(uint(initial ? 0xc3 : 0xe3, 1), uint(1, 4), ids, lengths, protectedBytes);
}

const rows = [
  ['initial-1', 0, false, 'handshake', 'INITIAL 1', ['Client Hello，第 1 部分'], [['Initial', 0, 1223]], 900],
  ['initial-2', 0, false, 'handshake', 'INITIAL 2', ['Client Hello，第 2 部分', '填充'], [['Initial', 1, 1223]], 1220],
  ['server-initial', 18, true, 'handshake', 'INITIAL', ['Server Hello'], [['Initial', 0, 1235]], 900],
  ['handshake-1', 18, true, 'handshake', 'HANDSHAKE 1', ['证书、Finished', '已加密'], [['Handshake', 0, 1324]], 900],
  ['handshake-2', 18, true, 'handshake', 'HANDSHAKE 2', [], [['Handshake', 1, 1324]], 1180],
  ['handshake-3', 18, true, 'handshake', 'HANDSHAKE 3', [], [['Handshake', 2, 204]], 1460],
  ['finished', 36, false, 'handshake', 'FINISHED', ['Initial + Handshake'], [['Initial', 2, 1138], ['Handshake', 0, 59]], 900],
  ['request', 36, false, 'request', 'GET /', ['HTTP/3，流 0'], [['1-RTT', 0, 340]], 1220],
  ['response', 54, true, 'response', '200', ['HTTP/3，流 0', '页面'], [['1-RTT', 0, 1205]], 900],
  ['ack', 71, false, 'request', 'ACK', [], [['1-RTT', 1, 21]], 650],
];

let sample = 0;
export const frames = rows.map(([id, ms, server, category, badgeLabel, badge, packets, leadMs], i) => {
  const src = addresses[server ? 'web' : 'client'], dst = addresses[server ? 'client' : 'web'];
  const quic = packets.map(([type, number, sealed], j) => ({ type, number, sealed, inner: contents[sample + j] }));
  const payload = concat(...quic.map(packet => packetBytes(packet, server, sample++)));
  const transport = udp({ src, dst, srcPort: server ? 443 : 59214, dstPort: server ? 59214 : 443, payload });
  const bytes = ethernet({ src: macs[Number(server)], dst: macs[Number(!server)],
    payload: ipv4({ src, dst, protocol: 17, payload: transport, id: 0xd825 + i, ttl: server ? 64 : 128 }),
  });
  return { id, path: server ? path.toReversed() : path, bytes, inspect: inspectQUIC, quic, protocol: 'QUIC',
    time: `0.${String(ms).padStart(3, '0')}s`, category, summary: summaries[i], badgeLabel, badge, leadMs,
    holdMs: i === 9 ? 750 : 1450, locked: i >= 3,
  };
});

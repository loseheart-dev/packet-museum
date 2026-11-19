import { dns, ethernet, http, ipv4, tcp, udp } from '../../lib/bytes/index.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', resolver: '8.8.8.8', web: '203.0.113.10' };
const host = 'www.example.com';
const clientMac = '00:00:5e:00:53:10', routerMac = '00:00:5e:00:53:01';
const pathTo = endpoint => ['client', 'router', 'internet', endpoint];

function ethernetIPv4(src, dst, id, ttl, flags, protocol, payload, reply) {
  return ethernet({ src: reply ? routerMac : clientMac, dst: reply ? clientMac : routerMac, pad: true,
    payload: ipv4({ src, dst, id, ttl, flags, protocol, payload }) });
}

function dnsFrame(reply) {
  const src = addresses[reply ? 'resolver' : 'client'], dst = addresses[reply ? 'client' : 'resolver'];
  const payload = dns({ id: 15642, flags: reply ? 0x8180 : 0x0100, questions: [{ name: host }],
    answers: reply ? [{ name: host, type: 'A', ttl: 1745, data: addresses.web }] : [] });
  return ethernetIPv4(src, dst, reply ? 35790 : 55333, reply ? 118 : 128, reply ? 0x4000 : 0, 17,
    udp({ src, dst, srcPort: reply ? 53 : 59321, dstPort: reply ? 59321 : 53, payload }), reply);
}

const synOptions = [
  Uint8Array.of(2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2),
  Uint8Array.of(2, 4, 5, 180, 1, 1, 4, 2, 1, 3, 3, 7),
];

const request = http({ startLine: 'GET / HTTP/1.1', headers: [
  ['Host', host],
  ['Connection', 'keep-alive'],
  ['Upgrade-Insecure-Requests', '1'],
  ['User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'],
  ['Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'],
  ['Accept-Encoding', 'gzip, deflate'],
  ['Accept-Language', 'en-US,en;q=0.9'],
] });

// shortcut: Original HTML is opaque; use a same-length placeholder until the inspector supports unknown bytes.
const response = http({ startLine: 'HTTP/1.1 200 OK', headers: [
  ['Date', 'Sat, 31 Oct 2026 09:41:00 GMT'],
  ['Content-Type', 'text/html; charset=utf-8'],
  ['Content-Length', '12500'],
  ['Connection', 'keep-alive'],
], body: '<html><body></body></html>'.padEnd(12500, ' ') });

const tcpFrames = [
  [false, 55334, 59972902, 0, 0x02, 64240, synOptions[0]],
  [true, 3587, 2474976680, 59972903, 0x12, 64240, synOptions[1]],
  [false, 55335, 59972903, 2474976681, 0x10, 1026],
  [false, 55336, 59972903, 2474976681, 0x18, 1026, undefined, request],
].map(([reply, id, seq, ack, flags, window, options, payload]) => {
  const src = addresses[reply ? 'web' : 'client'], dst = addresses[reply ? 'client' : 'web'];
  const segment = tcp({ src, dst, srcPort: reply ? 80 : 52344, dstPort: reply ? 52344 : 80,
    seq, ack, flags, window, options, payload });
  return ethernetIPv4(src, dst, id, reply ? 52 : 128, 0x4000, 6, segment, reply);
});

const rows = [
  ['resolver', false, dnsFrame(false), 'DNS', '0.000s', 'Standard query A www.example.com', 'dns', ['DNS 查询', 'A? www.example.com'], 'dns'],
  ['resolver', true, dnsFrame(true), 'DNS', '0.012s', 'Standard query response A 203.0.113.10', 'dns', ['DNS 响应', 'A 203.0.113.10'], 'dns'],
  ['web', false, tcpFrames[0], 'TCP', '0.024s', '52344 → 80 [SYN] Seq=0', 'tcp', ['SYN', 'seq=0']],
  ['web', true, tcpFrames[1], 'TCP', '0.041s', '80 → 52344 [SYN, ACK] Seq=0 Ack=1', 'tcp', ['SYN-ACK', 'seq=0 ack=1']],
  ['web', false, tcpFrames[2], 'TCP', '0.058s', '52344 → 80 [ACK] Seq=1 Ack=1', 'tcp', ['ACK', 'seq=1 ack=1']],
  ['web', false, tcpFrames[3], 'HTTP', '0.058s', 'GET / HTTP/1.1', 'request', ['GET / HTTP/1.1', 'Host: www.example.com'], 'http'],
];

export const responseIds = [];
const { client, web } = addresses;
for (let offset = 0, i = 0; offset < response.length; offset += 1460, i++) {
  const payload = response.subarray(offset, offset + 1460), last = offset + payload.length === response.length;
  const segment = tcp({ src: web, dst: client, srcPort: 80, dstPort: 52344,
    seq: 2474976681 + offset, ack: 59972903 + request.length, flags: last ? 0x18 : 0x10, window: 501, payload });
  responseIds.push(`http-${rows.length + 1}`);
  rows.push(['web', true, ethernetIPv4(web, client, 3588 + i, 52, 0x4000, 6, segment, true), 'TCP', '0.076s',
    `HTTP 响应 · TCP 段 ${i + 1}/9`, 'reply', ['HTTP/1.1 200 OK', '12.2 KB，分 9 个报文段'], undefined, 900 + i * 110]);
}

export const frames = rows.map(([endpoint, reply, bytes, protocol, time, summary, category, badge, application, leadMs], i) => {
  const path = pathTo(endpoint);
  if (reply) path.reverse();
  return {
    id: `http-${i + 1}`, path, bytes, protocol, time, summary, category, badge, application,
    ...(i === 0 ? { leadMs: 2400 } : {}),
    ...(leadMs !== undefined ? { leadMs } : {}),
  };
});

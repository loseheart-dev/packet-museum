import { concat, ethernet, http, ipv4, tcp, text, uint } from '../../lib/bytes/index.js';
import { applyMask, inspectWebSocket } from './parse.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', web: '203.0.113.10' };
const path = ['client', 'router', 'internet', 'web'];
const reversePath = path.toReversed();
const key = 'dGhlIHNhbXBsZSBub25jZQ==';
const request = http({ startLine: 'GET /chat HTTP/1.1', headers: [
  ['Host', 'www.example.com'], ['Connection', 'Upgrade'], ['Pragma', 'no-cache'], ['Cache-Control', 'no-cache'],
  ['User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'],
  ['Upgrade', 'websocket'], ['Origin', 'http://www.example.com'], ['Sec-WebSocket-Version', '13'],
  ['Accept-Encoding', 'gzip, deflate'], ['Accept-Language', 'en-US,en;q=0.9'], ['Sec-WebSocket-Key', key],
  ['Sec-WebSocket-Extensions', 'permessage-deflate; client_max_window_bits'],
] });
const response = http({ startLine: 'HTTP/1.1 101 Switching Protocols', headers: [
  ['Upgrade', 'websocket'], ['Connection', 'Upgrade'],
  // 此固定报文的 SHA-1 + Base64 结果由 test.mjs 从请求密钥独立计算校验。
  ['Sec-WebSocket-Accept', 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='],
] });

function websocket(opcode, body = new Uint8Array(), mask = []) {
  const key = Uint8Array.from(mask);
  return concat(Uint8Array.of(128 | opcode, (key.length ? 128 : 0) | body.length), key, key.length ? applyMask(body, key) : body);
}

const SYN = 0x02, ACK = 0x10, PSH = 0x08;
const clientOptions = Uint8Array.of(2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2);
const serverOptions = Uint8Array.of(2, 4, 5, 180, 1, 1, 4, 2, 1, 3, 3, 7);
const close = uint(1000, 2);
const segments = [
  ['0.000s', 'client', 'TCP', '52360 → 80 [SYN] Seq=0', 'SYN', [], { flags: SYN, options: clientOptions, leadMs: 2350 }],
  ['0.017s', 'web', 'TCP', '80 → 52360 [SYN, ACK] Seq=0 Ack=1', 'SYN-ACK', [], { flags: SYN | ACK, options: serverOptions }],
  ['0.034s', 'client', 'TCP', '52360 → 80 [ACK] Seq=1 Ack=1', 'ACK', [], { flags: ACK }],
  ['0.034s', 'client', 'HTTP', 'GET /chat HTTP/1.1', 'UPGRADE', ['GET /chat HTTP/1.1', 'Upgrade: websocket'], { payload: request }],
  ['0.052s', 'web', 'HTTP', 'HTTP/1.1 101 Switching Protocols', '101', ['101 Switching Protocols', 'Upgrade: websocket'], { payload: response, holdMs: 1750 }],
  ['2.400s', 'client', 'WebSocket', 'WebSocket Text [FIN] [MASKED]', '文本', ['"Hello"', '已掩码'], { payload: websocket(1, text('Hello'), [55, 250, 33, 61]) }],
  ['6.810s', 'web', 'WebSocket', 'WebSocket Text [FIN]', '文本', ['"bob: hi there"', '无需请求'], { payload: websocket(1, text('bob: hi there')) }],
  ['36.810s', 'web', 'WebSocket', 'WebSocket Ping [FIN]', 'PING', [], { payload: websocket(9) }],
  ['36.827s', 'client', 'WebSocket', 'WebSocket Pong [FIN] [MASKED]', 'PONG', [], { payload: websocket(10, undefined, [92, 30, 144, 114]) }],
  ['40.000s', 'client', 'WebSocket', 'WebSocket Connection Close [FIN] [MASKED]', '关闭', ['1000 正常关闭'], { payload: websocket(8, close, [163, 75, 7, 217]) }],
  ['40.018s', 'web', 'WebSocket', 'WebSocket Connection Close [FIN]', '关闭', ['1000 正常关闭'], { payload: websocket(8, close) }],
];

const isn = { client: 2468862306, web: 1893392262 };
const ipId = { client: 55333, web: 3587 };
const next = { client: 0, web: 0 };

export const frames = segments.map(([time, from, protocol, summary, badgeLabel, badge, { flags = PSH | ACK, options, payload, leadMs, holdMs }], i) => {
  const to = from === 'client' ? 'web' : 'client';
  const src = addresses[from], dst = addresses[to];
  const [srcPort, dstPort] = from === 'client' ? [52360, 80] : [80, 52360];
  const ackBase = flags & ACK ? isn[to] : null;
  const transport = tcp({ src, dst, srcPort, dstPort, seq: isn[from] + next[from], ack: ackBase === null ? 0 : ackBase + next[to],
    flags, options, payload, window: flags & SYN ? 64240 : from === 'client' ? 1026 : 501 });
  next[from] += (payload?.length ?? 0) + Number(Boolean(flags & SYN));
  const mac = node => node === 'client' ? '00:00:5e:00:53:10' : '00:00:5e:00:53:01';
  const bytes = ethernet({ src: mac(from), dst: mac(to), pad: true,
    payload: ipv4({ src, dst, protocol: 6, payload: transport, id: ipId[from]++, ttl: from === 'client' ? 128 : 52 }) });
  return {
    id: `websocket-${i + 1}`, path: from === 'client' ? path : reversePath, bytes, protocol, time, summary, badge, badgeLabel,
    category: protocol === 'TCP' ? 'tcp' : from, relativeTo: [isn[from], ackBase],
    ...(protocol === 'HTTP' ? { application: 'http' } : protocol === 'WebSocket' ? { inspect: inspectWebSocket } : {}),
    ...(leadMs === undefined ? {} : { leadMs }), ...(holdMs === undefined ? {} : { holdMs }),
  };
});

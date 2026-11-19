import { concat, ethernet, http, ipv4, tcp, uint } from '../../lib/bytes/index.js';

export const client = '192.168.1.10', server = '203.0.113.10';
const path = ['client', 'router', 'internet', 'web'];
const reversePath = path.toReversed();
const request = http({ startLine: 'GET / HTTP/1.1', headers: [['Host', 'www.example.com'], ['User-Agent', 'curl/8.9.1'], ['Accept', '*/*']] });
// The reference leaves the response opaque; these placeholder bytes preserve segment lengths.
const first = new Uint8Array(1460), second = new Uint8Array(1460).fill(1);
const clientSyn = Uint8Array.of(2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2);
const serverSyn = Uint8Array.of(2, 4, 5, 180, 1, 1, 4, 2, 1, 3, 3, 7);
const sack = concat(Uint8Array.of(1, 1, 5, 10), uint(1461, 4), uint(2921, 4));
const FIN = 0x01, SYN = 0x02, PSH = 0x08, ACK = 0x10;

const segments = [
  ['0.000s', false, SYN,       0,    0, 'control', '[SYN] Seq=0',                              ['seq=0'], { options: clientSyn, leadMs: 2300 }],
  ['0.017s', true,  SYN|ACK,   0,    1, 'control', '[SYN, ACK] Seq=0 Ack=1',                   ['seq=0 ack=1'], { options: serverSyn }],
  ['0.034s', false, ACK,       1,    1, 'control', '[ACK] Seq=1 Ack=1',                        ['seq=1 ack=1']],
  ['0.034s', false, PSH|ACK,   1,    1, 'request', '[PSH, ACK] Seq=1 Ack=1 Len=78',           ['seq=1  len=78', 'GET / HTTP/1.1 …'], { payload: request, application: 'http' }],
  ['0.051s', true,  ACK,       1,   79, 'control', '[ACK] Seq=1 Ack=79',                       ['ack=79']],
  ['0.052s', true,  ACK,       1,   79, 'response', '[ACK] Seq=1 Ack=79 Len=1460',             ['报文段 1 丢失', 'seq=1'], { payload: first, outcome: 'dropped' }],
  ['0.052s', true,  PSH|ACK, 1461,  79, 'response', '[PSH, ACK] Seq=1461 Ack=79 Len=1460',    ['seq=1 和 seq=1461'], { payload: second, leadMs: 250 }],
  ['0.069s', false, ACK,      79,    1, 'control', '[ACK] Seq=79 Ack=1 SLE=1461 SRE=2921',     ['ack=1', 'sack：已有 1461–2920'], { options: sack }],
  ['0.095s', true,  ACK,       1,   79, 'response', '[TCP Retransmission] Seq=1 Ack=79 Len=1460', ['seq=1  len=1460', '只有缺失的报文段'], { payload: first }],
  ['0.112s', false, ACK,      79, 2921, 'control', '[ACK] Seq=79 Ack=2921',                    ['ack=2921']],
  ['0.113s', false, FIN|ACK,  79, 2921, 'finish',  '[FIN, ACK] Seq=79 Ack=2921',               ['seq=79  ack=2921']],
  ['0.130s', true,  ACK,    2921,   80, 'control', '[ACK] Seq=2921 Ack=80',                    ['ack=80']],
  ['0.131s', true,  FIN|ACK,2921,   80, 'finish',  '[FIN, ACK] Seq=2921 Ack=80',               ['seq=2921  ack=80']],
  ['0.148s', false, ACK,      80, 2922, 'control', '[ACK] Seq=80 Ack=2922',                    ['ack=2922']],
];

export const frames = segments.map(([time, inbound, flags, seq, ack, category, summary, badge, { options, payload, ...presentation } = {}], i) => {
  const [src, dst] = inbound ? [server, client] : [client, server];
  const [srcPort, dstPort] = inbound ? [80, 49152] : [49152, 80];
  const [sourceMac, targetMac] = inbound ? ['00:00:5e:00:53:01', '00:00:5e:00:53:10'] : ['00:00:5e:00:53:10', '00:00:5e:00:53:01'];
  const window = flags & SYN ? 64240 : inbound ? 501 : 1026;
  const transport = tcp({ src, dst, srcPort, dstPort, seq, ack, flags, window, options, payload });
  // shortcut: unpadded frames, add the six link-layer padding bytes once the inspector supports them.
  const bytes = ethernet({ src: sourceMac, dst: targetMac,
    payload: ipv4({ src, dst, protocol: 6, id: 0x1c40 + i, ttl: inbound ? 52 : 128, payload: transport }) });
  return { id: `tcp-${i + 1}`, path: inbound ? reversePath : path, bytes, protocol: 'TCP', time,
    summary: `${srcPort} → ${dstPort} ${summary}`, category, badge, ...presentation };
});

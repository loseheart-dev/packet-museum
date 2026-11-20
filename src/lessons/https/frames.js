import { concat, dns, ethernet, ipv4, tcp, text, tlsExtension, tlsHello, tlsRecord, udp, uint } from '../../lib/bytes/index.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', resolver: '8.8.8.8', web: '203.0.113.10' };
export const url = 'https://www.example.com';
const hostname = 'www.example.com', clientPort = 52411, dnsPort = 61744, mss = 1460;
const mac = ['00:00:5e:00:53:10', '00:00:5e:00:53:01'];

// shortcut: illustrative bytes, not valid keys or ciphertext; replace only if the lesson uses a real capture.
function sample(length, seed) {
  return Uint8Array.from({ length }, () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return seed & 255;
  });
}

const vector = (bytes, width) => concat(uint(bytes.length, width), bytes);
const words = (...values) => concat(...values.map(value => uint(value, 2)));
const hybrid = 0x11ec, x25519 = 0x001d;
const keyShare = (group, length, seed) => concat(words(group), vector(sample(length, seed), 2));
const session = sample(32, 2);
const extensions = [
  tlsExtension(0, vector(concat(uint(0, 1), vector(text(hostname), 2)), 2)),
  tlsExtension(10, vector(words(hybrid, x25519), 2)),
  tlsExtension(13, vector(words(0x0403, 0x0804, 0x0807), 2)),
  tlsExtension(16, vector(concat(vector(text('h2'), 1), vector(text('http/1.1'), 1)), 2)),
  tlsExtension(43, vector(words(0x0304, 0x0303), 1)),
  tlsExtension(51, vector(concat(keyShare(hybrid, 1216, 3), keyShare(x25519, 32, 4)), 2)),
];
const client = { random: sample(32, 1), session, suites: [0x1301, 0x1302, 0x1303, 0xc02f], extensions };
const padding = tlsExtension(21, new Uint8Array(1845 - tlsHello(client).length - 4));
const clientHello = tlsRecord({ type: 22, version: 0x0301, payload: tlsHello({ ...client, extensions: [...extensions, padding] }) });
const serverHello = tlsRecord({ type: 22, payload: tlsHello({ server: true, random: sample(32, 5), session,
  extensions: [tlsExtension(43, words(0x0304)), tlsExtension(51, keyShare(hybrid, 1120, 6))],
}) });
const ccs = tlsRecord({ type: 20, payload: uint(1, 1) });
const encrypted = (length, seed) => tlsRecord({ type: 23, payload: sample(length, seed) });
const serverFlight = concat(serverHello, ccs, encrypted(2724, 7));
const synOptions = [
  Uint8Array.of(2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2),
  Uint8Array.of(2, 4, 5, 180, 1, 1, 4, 2, 1, 3, 3, 7),
];

const rows = [
  ['query', 'resolver', false, '0.000s', 'DNS 查询', 'Standard query A www.example.com', ['A? www.example.com']],
  ['reply', 'resolver', true, '0.012s', 'DNS 响应', 'Standard query response A 203.0.113.10', ['A 203.0.113.10']],
  ['syn', 'web', false, '0.024s', 'SYN', '52411 → 443 [SYN] Seq=0', ['seq=0']],
  ['syn-ack', 'web', true, '0.041s', 'SYN-ACK', '443 → 52411 [SYN, ACK] Seq=0 Ack=1', ['seq=0 ack=1']],
  ['ack', 'web', false, '0.058s', 'ACK', '52411 → 443 [ACK] Seq=1 Ack=1', ['seq=1 ack=1']],
  ['client-hello', 'web', false, '0.058s', 'CLIENT HELLO', 'Client Hello (SNI=www.example.com)，2 个报文段', ['TLS 1.3, SNI www.example.com', '密钥共享：混合 + x25519'], clientHello],
  ['server-hello', 'web', true, '0.076s', 'SERVER HELLO', 'Server Hello + 加密握手，3 个报文段', ['加密算法：AES_128_GCM_SHA256', '随后加密：证书、Finished'], serverFlight],
  ['finished', 'web', false, '0.094s', 'FINISHED', 'Change Cipher Spec，Finished（已加密）', ['握手完成（已加密）'], concat(ccs, encrypted(53, 8))],
  ['request', 'web', false, '0.094s', '应用数据', 'Application Data（HTTP 请求）', ['内部：GET / HTTP/1.1', '外部：加密的字节'], encrypted(682, 9)],
  ['tickets', 'web', true, '0.111s', 'TICKETS', 'New Session Ticket ×2（已加密）', [], concat(encrypted(234, 10), encrypted(234, 11))],
  ['response', 'web', true, '0.112s', '应用数据', 'Application Data（HTTP 响应），9 个报文段', ['内部：HTTP/1.1 200 OK', '外部：12.9 KB，9 个报文段'], encrypted(12705, 12)],
];

const seq = [0, 0];
let ipId = 0;
export const messages = Object.fromEntries(rows.map(([id, endpoint, reply, time, badgeLabel, summary, badge, payload], i) => {
  const src = addresses[reply ? endpoint : 'client'], dst = addresses[reply ? 'client' : endpoint];
  const path = ['client', 'router', 'internet', endpoint];
  if (reply) path.reverse();
  const dir = Number(reply), protocol = i < 2 ? 'DNS' : payload ? 'TLSv1.3' : 'TCP';
  const category = i < 2 ? 'dns' : i < 5 ? 'tcp' : i < 8 ? 'handshake' : reply ? 'reply' : 'request';
  const count = payload ? Math.ceil(payload.length / mss) : 1;
  const frames = Array.from({ length: count }, (_, part) => {
    let transport;
    if (endpoint === 'resolver') {
      const packet = dns({ id: 31810, flags: reply ? 0x8180 : 0x0100, questions: [{ name: hostname }],
        answers: reply ? [{ name: hostname, type: 'A', ttl: 1722, data: addresses.web }] : [] });
      transport = udp({ src, dst, srcPort: reply ? 53 : dnsPort, dstPort: reply ? dnsPort : 53, payload: packet });
    } else {
      const data = payload?.subarray(part * mss, (part + 1) * mss);
      const flags = i === 2 ? 0x02 : i === 3 ? 0x12 : data && part === count - 1 ? 0x18 : 0x10;
      transport = tcp({ src, dst, srcPort: reply ? 443 : clientPort, dstPort: reply ? clientPort : 443,
        seq: seq[dir], ack: flags & 0x10 ? seq[1 - dir] : 0, flags, options: flags & 0x02 ? synOptions[dir] : undefined, payload: data });
      seq[dir] += (data?.length ?? 0) + Number(Boolean(flags & 0x02));
    }
    const bytes = ethernet({ src: mac[dir], dst: mac[1 - dir], pad: true,
      payload: ipv4({ src, dst, protocol: i < 2 ? 17 : 6, payload: transport, id: ++ipId,
        ttl: !reply ? 128 : endpoint === 'resolver' ? 118 : 52, flags: i === 0 ? 0 : 0x4000 }) });
    return {
      id: `${id}${part ? `-${part + 1}` : ''}`, path, time, bytes, protocol, summary, badgeLabel, badge, category,
      application: i < 2 ? 'dns' : payload && count === 1 ? 'tls' : undefined,
      locked: i >= 7, leadMs: (i === 0 ? 2400 : 650) + part * 110, holdMs: i === 9 ? 500 : 1450,
    };
  });
  return [id, frames];
}));

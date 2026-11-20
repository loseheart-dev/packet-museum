import { ethernet, inspectFrame, ipv4, tcp, tlsRecord, udp } from '../../lib/bytes/index.js';
import { Reader, requireBytes, uint } from '../../lib/bytes/core.js';
import { dtls, parseDTLS, parseSRTP, parseSTUN, sample, srtp, stun } from './datagrams.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', relay: '192.0.2.19', web: '203.0.113.10', remote: '198.51.100.200', peer: '192.168.0.23' };
const paths = {
  client: ['client', 'router', 'internet', 'web'], relay: ['client', 'router', 'internet', 'relay'],
  direct: ['client', 'router', 'internet', 'remote', 'peer'], peer: ['peer', 'remote', 'internet', 'web'],
};
const ports = { client: 56143, relay: 3478, peer: 49170 };
const webPorts = { client: 50918, web: 443, peer: 50731 };
const mac = { client: '10', router: '01', relay: '19', web: '02', remote: '20', peer: '23', internet: 'fe' };
const wireAddress = id => addresses[id === 'peer' ? 'remote' : id];
const publicAddress = { address: '198.51.100.7', port: 61022 };
const timeLabel = seconds => `${seconds.toFixed(3)}s`;
const signaling = 'TLSv1.3', handshake = 'DTLSv1.2';
let identification = 0;

function frameBytes(path, transport, payload, options = {}) {
  const [from, hop] = path, to = path.at(-1);
  const src = wireAddress(from), dst = wireAddress(to), isTCP = transport === tcp;
  const port = isTCP ? webPorts : ports;
  return ethernet({ src: `00:00:5e:00:53:${mac[from === 'peer' ? 'remote' : from]}`, dst: `00:00:5e:00:53:${mac[from === 'peer' ? 'internet' : hop]}`,
    payload: ipv4({ src, dst, id: ++identification, ttl: from === 'client' ? 128 : from === 'peer' ? (isTCP ? 63 : 51) : 64, protocol: isTCP ? 6 : 17,
      payload: transport({ src, dst, srcPort: port[from], dstPort: port[to], payload, ...options }) }),
  });
}

function inspect({ bytes, protocol }) {
  const decoded = inspectFrame({ bytes });
  const { layers } = decoded;
  const { label, offset, length } = layers.at(-1);
  requireBytes(label === '载荷' && layers.at(-2)?.label === 'UDP', `${protocol} 缺少 UDP 载荷`);
  const r = new Reader(bytes.subarray(offset, offset + length), offset, protocol, 'dns');
  ({ STUN: parseSTUN, [handshake]: parseDTLS, SRTP: parseSRTP })[protocol](r);
  r.end();
  layers[layers.length - 1] = r.layer();
  return decoded;
}

function datagram(id, path, protocol, time, summary, [badgeLabel, ...badge], category, payload, timing = {}) {
  return { id, path, protocol, time: timeLabel(time), summary, badgeLabel, badge, category,
    bytes: frameBytes(path, udp, payload), inspect, locked: category === 'media' || id === 'finished', ...timing };
}

const toWeb = paths.client, fromWeb = toWeb.toReversed();
const toPeer = paths.direct, fromPeer = toPeer.toReversed();
const toStun = paths.relay, fromStun = toStun.toReversed();
const seq = { client: [2817, 5934], peer: [4410, 1934] };
const tcpTimestamp = (id, direction) => Uint8Array.of(1, 1, 8, 10, ...uint(113810 + id + direction, 4), ...uint(41240 + id, 4));
export const reassembly = [];

function signal(id, path, seconds, message, length, [badgeLabel, ...badge], leadMs = 750) {
  const fromBrowser = path[0] !== 'web', direction = Number(!fromBrowser);
  const sam = path.includes('peer'), flow = seq[sam ? 'peer' : 'client'];
  const record = tlsRecord({ type: 23, payload: sample(length + (length > 125 ? 4 : 2) + (fromBrowser ? 4 : 0) + 17, identification + 1) });
  const mss = sam ? 1448 : 1460, count = Math.ceil(record.length / mss);
  const summary = `Application Data (WebSocket: ${message})${count > 1 ? `，${count} 个报文段` : ''}`;
  const frames = Array.from({ length: count }, (_, i) => {
    const payload = record.subarray(i * mss, (i + 1) * mss);
    const bytes = frameBytes(path, tcp, payload, { seq: flow[direction], ack: flow[1 - direction], flags: i === count - 1 ? 0x18 : 0x10,
      options: sam ? tcpTimestamp(identification, direction) : undefined });
    flow[direction] += payload.length;
    return { id: i ? `${id}-${i + 1}` : id, path, bytes, protocol: signaling, time: timeLabel(seconds), summary, category: 'signal',
      badgeLabel, badge, locked: true, leadMs: leadMs + i * 125, holdMs: 1450,
      ...(count === 1 ? { application: 'tls' } : {}),
    };
  });
  if (count > 1) reassembly.push({ frames: frames.map(frame => frame.id), protocol: signaling, application: 'tls', summary });
  return frames;
}

const binding = (id, path, time, summary, badge, { response, ice } = {}) => datagram(id, path, 'STUN', time, summary, badge, 'stun',
  stun({ response, ice, ...publicAddress }), { holdMs: 1650 });
const mapped = 'Binding Success Response XOR-MAPPED-ADDRESS: 198.51.100.7:61022';
const flight = (id, path, time, summary, badge, records) => datagram(id, path, handshake, time, summary, badge, 'dtls', dtls(records), { leadMs: 420, holdMs: 920 });
const media = (id, path, time, badge, data, i) => datagram(id, path, 'SRTP', time,
  `PT=${data.pt}, SSRC=0x${data.ssrc.toString(16).toUpperCase()}, Seq=${data.seq}, Time=${data.ts}${data.marker ? ', Mark' : ''}`,
  badge, 'media', srtp(data), { leadMs: 680 + i * 240, holdMs: 1050 });

export const stepFrames = [
  [...signal('join-room', toWeb, 0, 'join', 27, ['加入', '房间 42'], 2350),
    ...signal('peer-here', fromWeb, .018, 'peer', 28, ['Sam 在这里', '对端：Sam'])],
  [binding('binding-request', toStun, .04, 'Binding Request', ['BINDING?', '我的地址是什么？']),
    binding('binding-response', fromStun, .05, mapped, ['你的地址', '198.51.100.7:61022'], { response: true })],
  [...signal('offer-to-server', toWeb, .07, 'offer', 4738, ['提议', 'SDP：音频、视频', '候选地址']),
    ...signal('offer-to-sam', paths.peer.toReversed(), .088, 'offer', 4754, ['提议', '发给 Sam'])],
  [...signal('answer-to-server', paths.peer, 2.4, 'answer', 2900, ['应答', 'SDP: Opus, VP8', '候选地址']),
    ...signal('answer-to-caller', fromWeb, 2.421, 'answer', 2916, ['应答', '来自 Sam'])],
  [binding('ice-check', toPeer, 2.44, 'Binding Request user: q7Rz:Hk2w', ['检查', 'to 198.51.100.200:49170'], { ice: true }),
    binding('ice-response', fromPeer, 2.466, mapped, ['成功了', '直连路径'], { response: true, ice: true })],
  [flight('client-hello', fromPeer, 2.47, 'Client Hello', ['CLIENT HELLO'], [[1, 0, 0, 151]]),
    flight('server-hello', toPeer, 2.497, 'Server Hello, Certificate, Key Exchange, Cert Request, Hello Done', ['SERVER HELLO', '证书'],
      [[2, 0, 0, 88], [11, 1, 1, 322], [12, 2, 2, 111], [13, 3, 3, 26], [14, 4, 4, 0]]),
    flight('client-certificate', fromPeer, 2.53, 'Certificate, Key Exchange, Cert Verify, Change Cipher Spec, Finished', ['证书', 'Finished'],
      [[11, 1, 1, 322], [16, 2, 2, 33], [15, 3, 3, 75], ['ccs', 4], ['finished', 0, 0, 48]]),
    flight('finished', toPeer, 2.557, 'Change Cipher Spec, Finished', ['FINISHED'], [['ccs', 5], ['finished', 0, 0, 48]])],
  [...[0, 1, 2].map(i => media(`audio-${i + 1}`, toPeer, 2.59 + .02 * i, ['音频', 'Opus，每 20 ms'],
    { pt: 111, seq: 9021 + i, ts: 416820 + 960 * i, ssrc: 0x5d2e81a4, level: 38 + i, tw: 12 + i, media: 62 }, i)),
  ...[0, 1, 2].map(i => media(`video-${i + 1}`, fromPeer, 2.66 + .002 * i, ['视频', 'VP8，一帧分 3 个包'],
    { pt: 96, marker: i === 2, seq: 30117 + i, ts: 2286000, ssrc: 0x1b7c3f90, sent: 2772752 + i, tw: 40 + i, media: i === 2 ? 730 : 1100 }, i))],
  [],
];

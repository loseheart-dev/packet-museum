import { concat, ethernet, ipv4, text, udp, uint } from '../../lib/bytes/index.js';
import { inspectSIP } from './parse.js';

const alice = '192.168.1.10', server = '203.0.113.50', bob = '192.168.0.23', remote = '198.51.100.200';
export const addresses = { client: alice, router: '192.168.1.1', relay: server, peer: bob, remote };
const paths = {
  cr: ['client', 'router', 'internet', 'relay'], rc: ['relay', 'internet', 'router', 'client'],
  rp: ['relay', 'internet', 'remote', 'peer'], pr: ['peer', 'remote', 'internet', 'relay'],
};
const ipIds = { c: 0xd825, r: 0xf7a7, p: 0xa567 };
const macs = { cr: ['10', '01'], rc: ['01', '10'], rp: ['40', '80'], pr: ['41', '81'] };
const mac = end => `00:00:5e:00:53:${end}`;
const wrap = (i, path, protocol, time, category, summary, badge, bytes, srcPort, dstPort, quick) => {
  const src = { c: alice, r: server, p: remote }[path[0]], dst = { c: alice, r: server, p: remote }[path[1]];
  const [srcMac, dstMac] = macs[path];
  return {
    id: `sip-${i}`, path: paths[path], protocol, time, category, summary, badge, inspect: inspectSIP,
    leadMs: i === 1 || i === 5 ? 2350 : quick ? 300 : 650, holdMs: quick ? 550 : 1350,
    bytes: ethernet({ src: mac(srcMac), dst: mac(dstMac), payload: ipv4({
      src, dst, protocol: 17, id: ipIds[path[0]]++, ttl: src === alice ? 128 : dst === alice ? 52 : 64,
      flags: src === alice ? 0 : 0x4000, payload: udp({ src, dst, srcPort, dstPort, payload: bytes }),
    }) }),
  };
};

const via = `Via: SIP/2.0/UDP ${alice}:5060;rport;branch=z9hG4bK`;
const received = `Via: SIP/2.0/UDP ${alice}:5060;rport=5060;received=198.51.100.7;branch=z9hG4bK`;
const viaServer = `Via: SIP/2.0/UDP ${server};branch=z9hG4bK`;
const viaBob = `Via: SIP/2.0/UDP ${bob}:5060;rport;branch=z9hG4bK-b1`;
const receivedBob = `Via: SIP/2.0/UDP ${bob}:5060;rport=5060;received=${remote};branch=z9hG4bK-b1`;
const aliceURI = `sip:alice@${alice}:5060`, bobURI = `sip:bob@${bob}:5060`;
const fromAlice = 'From: "Alice" <sip:alice@example.net>;tag=f1c2';
const toBob = 'To: <sip:bob@example.net>', bobTag = `${toBob};tag=b8e4`;
const callId = `Call-ID: call-7c2e@${alice}`;
const recordRoute = `Record-Route: <sip:${server};lr>`, route = `Route: <sip:${server};lr>`;
const contact = uri => `Contact: <${uri}>`;
const registered = ['From: <sip:alice@example.net>;tag=a73k', 'To: <sip:alice@example.net>'];
const regId = `Call-ID: reg-5e1f@${alice}`;
const digest = 'Authorization: Digest username="alice", realm="example.net", nonce="7b2e91c4", uri="sip:example.net", response="4c1e7a9d02b35f68e1a9c47d0b2f6e13", qop=auth, nc=00000001, cnonce="d3f0"';
const challenge = 'WWW-Authenticate: Digest realm="example.net", nonce="7b2e91c4", qop="auth", algorithm=MD5';
const register = (n, auth = []) => ['REGISTER sip:example.net SIP/2.0', `${via}-r${n}`, 'Max-Forwards: 70',
  ...registered, regId, `CSeq: ${n} REGISTER`, contact(aliceURI), ...auth, 'Expires: 3600'];
const regReply = (n, status, header) => [`SIP/2.0 ${status}`, `${received}-r${n}`, registered[0],
  `${registered[1]};tag=s91d`, regId, `CSeq: ${n} REGISTER`, header];
const invite = [fromAlice, toBob, callId, 'CSeq: 1 INVITE'];
const inviteReply = (status, proxy) => [`SIP/2.0 ${status}`, ...(proxy ? [`${viaServer}-p1`] : []),
  `${received}-i1`, recordRoute, fromAlice, bobTag, callId, 'CSeq: 1 INVITE', contact(bobURI)];
const ack = [fromAlice, bobTag, callId, 'CSeq: 1 ACK'];
const bye = ['From: <sip:bob@example.net>;tag=b8e4', 'To: "Alice" <sip:alice@example.net>;tag=f1c2', callId, 'CSeq: 1 BYE'];
const sdp = (origin, ip, port) => `v=0\r\no=${origin} IN IP4 ${ip}\r\ns=-\r\nc=IN IP4 ${ip}\r\nt=0 0\r\nm=audio ${port} RTP/AVP 0 101\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:101 telephone-event/8000\r\n`;
function signal(i, time, path, summary, badge, headers, body = '', quick) {
  const bytes = text(`${headers.join('\r\n')}\r\n${body ? 'Content-Type: application/sdp\r\n' : ''}Content-Length: ${text(body).length}\r\n\r\n${body}`);
  return wrap(i, path, body ? 'SIP/SDP' : 'SIP', time, summary.startsWith('Request:') ? 'request' : 'response', summary, badge, bytes, 5060, 5060, quick);
}

// The reference leaves audio bytes unknown; use G.711 PCMU silence so the UDP checksum is concrete.
function voice(i, time, path, badge, seq, timestamp, ssrc, srcPort, dstPort, quick) {
  const bytes = concat(uint(0x8080, 2), uint(seq, 2), uint(timestamp, 4), uint(ssrc, 4), new Uint8Array(160).fill(0xff));
  const summary = `PT=ITU-T G.711 PCMU, SSRC=0x${ssrc.toString(16).toUpperCase()}, Seq=${seq}, Time=${timestamp}`;
  return wrap(i, path, 'RTP', time, 'voice', summary, badge, bytes, srcPort, dstPort, quick);
}

const aliceRTP = [11203, 54720, 983503556], bobRTP = [30871, 913600, 2010179931];
export const stepFrames = [
  [
    signal(1, '0.000s', 'cr', 'Request: REGISTER sip:example.net', ['REGISTER', 'alice@example.net 在这里'], register(1)),
    signal(2, '0.021s', 'rc', 'Status: 401 Unauthorized', ['401', 'Unauthorized · 附带质询'], regReply(1, '401 Unauthorized', challenge)),
    signal(3, '0.042s', 'cr', 'Request: REGISTER sip:example.net', ['REGISTER', '再来一次，附上哈希'], register(2, [digest])),
    signal(4, '0.063s', 'rc', 'Status: 200 OK (REGISTER)', ['200 OK', '已登记'], regReply(2, '200 OK', `${contact(aliceURI)};expires=3600`)),
  ],
  [
    signal(5, '2.500s', 'cr', 'Request: INVITE sip:bob@example.net', ['INVITE', '呼叫 bob@example.net · SDP：G.711 音频'],
      ['INVITE sip:bob@example.net SIP/2.0', `${via}-i1`, 'Max-Forwards: 70', ...invite, contact(aliceURI)], sdp('alice 2890 2890', alice, 49170)),
    signal(6, '2.521s', 'rc', 'Status: 100 Trying', ['100 TRYING'], ['SIP/2.0 100 Trying', `${received}-i1`, ...invite], '', true),
    signal(7, '2.521s', 'rp', `Request: INVITE ${bobURI}`, ['INVITE', '转发给 Bob · 语音经过服务器'],
      [`INVITE ${bobURI} SIP/2.0`, recordRoute, `${viaServer}-p1`, `${received}-i1`, 'Max-Forwards: 69', ...invite, contact(aliceURI)], sdp('alice 2890 2890', server, 40002)),
  ],
  [
    signal(8, '2.560s', 'pr', 'Status: 180 Ringing', ['180 RINGING', 'Bob 的电话响了'], inviteReply('180 Ringing', true)),
    signal(9, '2.586s', 'rc', 'Status: 180 Ringing', ['180 RINGING', '发给 Alice'], inviteReply('180 Ringing', false)),
  ],
  [
    signal(10, '6.320s', 'pr', 'Status: 200 OK (INVITE)', ['200 OK', 'Bob 接听 · SDP：G.711 音频'],
      inviteReply('200 OK', true), sdp('bob 4410 4410', bob, 49172)),
    signal(11, '6.346s', 'rc', 'Status: 200 OK (INVITE)', ['200 OK', '已接听 · 语音经过服务器'],
      inviteReply('200 OK', false), sdp('bob 4410 4410', server, 40000)),
    signal(12, '6.367s', 'cr', `Request: ACK ${bobURI}`, ['ACK'],
      [`ACK ${bobURI} SIP/2.0`, `${via}-a1`, route, 'Max-Forwards: 70', ...ack], '', true),
    signal(13, '6.388s', 'rp', `Request: ACK ${bobURI}`, ['ACK'],
      [`ACK ${bobURI} SIP/2.0`, `${viaServer}-p2`, `${received}-a1`, 'Max-Forwards: 69', ...ack], '', true),
  ],
  [
    voice(14, '6.420s', 'cr', ['语音', 'Alice 的 20 ms'], ...aliceRTP, 49170, 40000),
    voice(15, '6.441s', 'rp', ['语音', 'Alice 的 20 ms'], ...aliceRTP, 40002, 49172, true),
    voice(16, '6.470s', 'pr', ['语音', 'Bob 的 20 ms'], ...bobRTP, 49172, 40002),
    voice(17, '6.496s', 'rc', ['语音', 'Bob 的 20 ms'], ...bobRTP, 40000, 49170, true),
  ],
  [
    signal(18, '9.800s', 'pr', `Request: BYE ${aliceURI}`, ['BYE', 'Bob 挂断'],
      [`BYE ${aliceURI} SIP/2.0`, viaBob, route, 'Max-Forwards: 70', ...bye]),
    signal(19, '9.826s', 'rc', `Request: BYE ${aliceURI}`, ['BYE', '发给 Alice'],
      [`BYE ${aliceURI} SIP/2.0`, `${viaServer}-p3`, receivedBob, 'Max-Forwards: 69', ...bye]),
    signal(20, '9.847s', 'cr', 'Status: 200 OK (BYE)', ['200 OK'],
      ['SIP/2.0 200 OK', `${viaServer}-p3`, receivedBob, ...bye], '', true),
    signal(21, '9.868s', 'rp', 'Status: 200 OK (BYE)', ['200 OK'], ['SIP/2.0 200 OK', receivedBob, ...bye], '', true),
  ],
];

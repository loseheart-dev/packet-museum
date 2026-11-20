import { concat, ethernet, http, ipv4, tcp, uint, udp } from '../../lib/bytes/index.js';
import { inspectRTSP, inspectRTP } from './parse.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', cam: '192.168.1.64' };
const macs = { client: '00:00:5e:00:53:10', cam: '00:00:5e:00:53:64' };
const url = `rtsp://${addresses.cam}:554/stream1`;
const session = '1185d200';
const agent = ['User-Agent', 'LibVLC/3.0.20 (LIVE555 Streaming Media v2016.11.28)'];
const challenge = 'Digest realm="IP Camera", nonce="3b8f2c61a4d0"';
const auth = uri => ['Authorization', `Digest username="viewer", ${challenge.slice(7)}, uri="${uri}", response="8d1f0c3e6a5b4927f1e0d2c3b4a59687"`];
const accept = ['Accept', 'application/sdp'];
const transport = 'RTP/AVP;unicast;client_port=50000-50001';
const ssrc = 0x5a1c3e7b, timestamp = 3725434208, firstSeq = 27493;
const sdp = [
  'v=0', `o=- 1701864000 1 IN IP4 ${addresses.cam}`, 's=Camera', 'c=IN IP4 0.0.0.0', 't=0 0',
  'a=control:*', 'm=video 0 RTP/AVP 96', 'a=rtpmap:96 H264/90000',
  'a=fmtp:96 packetization-mode=1;profile-level-id=640028', 'a=control:trackID=1', '',
].join('\r\n');

const wire = [];
const path = ['client', 'router', 'cam'];
const ipId = { client: 55333, cam: 25246 };
const isn = { client: 1233675269, cam: 2500248371 };
const nextSeq = { ...isn };

function frame(reply, time, protocol, summary, badgeLabel, badge, category, encode, extra) {
  const route = reply ? path.toReversed() : path;
  const [from, to] = [route[0], route.at(-1)];
  const src = addresses[from], dst = addresses[to];
  const rtp = protocol === 'RTP';
  const bytes = ethernet({ src: macs[from], dst: macs[to], pad: true,
    payload: ipv4({ src, dst, protocol: rtp ? 17 : 6, payload: encode(src, dst), id: ipId[from]++, ttl: reply ? 64 : 128 }) });
  wire.push({ id: `rtsp-${wire.length + 1}`, path: route, bytes, protocol, time, summary, badgeLabel, badge, category, ...extra });
}

function segment(reply, time, protocol, summary, badgeLabel, badge, category, flags, payload, extra) {
  const from = reply ? 'cam' : 'client', to = reply ? 'client' : 'cam';
  const seq = nextSeq[from], ack = flags & 0x10 ? nextSeq[to] : 0;
  const options = flags & 0x02 ? Uint8Array.of(2, 4, 5, 180, ...(reply ? [1, 1, 4, 2, 1, 3, 3, 7] : [1, 3, 3, 8, 1, 1, 4, 2])) : undefined;
  frame(reply, time, protocol, summary, badgeLabel, badge, category, (src, dst) => tcp({
    src, dst, srcPort: reply ? 554 : 52510, dstPort: reply ? 52510 : 554, seq, ack, flags,
    window: options ? 64240 : reply ? 501 : 1026, options, payload,
  }), { relativeTo: [isn[from], ack ? isn[to] : null], ...extra });
  nextSeq[from] += (payload?.length ?? 0) + (flags & 0x02 ? 1 : 0);
}

function message(reply, time, startLine, cseq, headers, badgeLabel, badge, body, summary) {
  const payload = http({ startLine, headers: [['CSeq', cseq], ...headers], body });
  segment(reply, time, body ? 'RTSP/SDP' : 'RTSP', summary ?? (reply ? `Reply: ${startLine}` : startLine),
    badgeLabel, badge, reply ? 'reply' : 'request', 0x18, payload, { inspect: inspectRTSP });
}

segment(false, '0.000s', 'TCP', '52510 → 554 [SYN] Seq=0', 'SYN', [], 'tcp', 0x02, undefined, { leadMs: 2400 });
segment(true, '0.002s', 'TCP', '554 → 52510 [SYN, ACK] Seq=0 Ack=1', 'SYN-ACK', [], 'tcp', 0x12);
segment(false, '0.004s', 'TCP', '52510 → 554 [ACK] Seq=1 Ack=1', 'ACK', [], 'tcp', 0x10);
message(false, '0.004s', `OPTIONS ${url} RTSP/1.0`, 1, [agent], 'OPTIONS', ['你能做什么？']);
message(true, '0.007s', 'RTSP/1.0 200 OK', 1, [['Public', 'OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN, GET_PARAMETER']], '200 OK', ['DESCRIBE, SETUP, PLAY…']);

message(false, '0.010s', `DESCRIBE ${url} RTSP/1.0`, 2, [agent, accept], 'DESCRIBE', ['描述 stream1']);
message(true, '0.013s', 'RTSP/1.0 401 Unauthorized', 2, [['WWW-Authenticate', challenge]], '401', ['请先登录']);
message(false, '0.016s', `DESCRIBE ${url} RTSP/1.0`, 3, [auth(url), agent, accept], 'DESCRIBE', ['再来一次，附上哈希']);
message(true, '0.020s', 'RTSP/1.0 200 OK', 3, [['Content-Base', `${url}/`], ['Content-Type', 'application/sdp']],
  '200 OK', ['SDP：H.264 视频', '轨道 1'], sdp, 'Reply: RTSP/1.0 200 OK, with session description');

message(false, '0.023s', `SETUP ${url}/trackID=1 RTSP/1.0`, 4, [auth(`${url}/`), agent, ['Transport', transport]],
  'SETUP', ['轨道 1，RTP over UDP', '发往端口 50000-50001']);
message(true, '0.026s', 'RTSP/1.0 200 OK', 4, [['Session', `${session};timeout=60`],
  ['Transport', `${transport};server_port=6970-6971;ssrc=${ssrc.toString(16).toUpperCase()}`]], '200 OK', ['会话 1185d200', '来自端口 6970-6971']);

message(false, '0.029s', `PLAY ${url}/ RTSP/1.0`, 5, [auth(`${url}/`), agent, ['Session', session], ['Range', 'npt=0.000-']], 'PLAY⁠', ['从现在播放']);
message(true, '0.032s', 'RTSP/1.0 200 OK', 5, [['Session', session], ['RTP-Info', `url=${url}/trackID=1;seq=${firstSeq};rtptime=${timestamp}`]], '200 OK', ['正在播放']);

for (const [i, length] of [1398, 1398, 900].entries()) {
  const last = i === 2;
  const seq = firstSeq + i;
  // The reference leaves video bytes unknown; zeros preserve offsets without claiming to be decodable footage.
  const payload = concat(Uint8Array.of(0x80, last ? 0xe0 : 0x60), uint(seq, 2), uint(timestamp, 4), uint(ssrc, 4),
    Uint8Array.of(0x7c, [0x85, 0x05, 0x45][i]), new Uint8Array(length));
  frame(true, `0.03${4 + i}s`, 'RTP', `PT=H.264 (96), SSRC=0x${ssrc.toString(16).toUpperCase()}, Seq=${seq}, Time=${timestamp}${last ? ', Mark' : ''}`,
    '视频', i === 0 ? ['3 个包组成的关键帧', 'UDP 6970 → 50000'] : [], 'video',
    (src, dst) => udp({ src, dst, srcPort: 6970, dstPort: 50000, payload }), { inspect: inspectRTP, leadMs: 900 + i * 390 });
}

message(false, '12.400s', `TEARDOWN ${url}/ RTSP/1.0`, 6, [auth(`${url}/`), agent, ['Session', session]], 'TEARDOWN', ['结束会话 1185d200']);
message(true, '12.403s', 'RTSP/1.0 200 OK', 6, [['Session', session]], '200 OK', ['已停止']);

export const frames = wire;

import { concat, ethernet, ipv4, tcp, text, uint } from '../../lib/bytes/index.js';
import { inspectRTMP } from './parse.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', web: '203.0.113.10' };
const path = ['client', 'router', 'internet', 'web'], inboundPath = path.toReversed();
const streamKey = 'live_29481_xk3Qe7', url = 'rtmp://live.example.com/live';
const mss = 1460, chunkSize = 4096;

const shortString = value => { const bytes = text(value); return concat(uint(bytes.length, 2), bytes); };
function amf(value, ecma = false) {
  if (value === null) return Uint8Array.of(5);
  if (typeof value === 'string') return concat(Uint8Array.of(2), shortString(value));
  if (typeof value === 'boolean') return Uint8Array.of(1, +value);
  if (typeof value === 'number') {
    const bytes = new Uint8Array(9);
    new DataView(bytes.buffer).setFloat64(1, value);
    return bytes;
  }
  const entries = Object.entries(value);
  return concat(ecma ? concat(Uint8Array.of(8), uint(entries.length, 4)) : Uint8Array.of(3),
    ...entries.map(([name, data]) => concat(shortString(name), amf(data))), Uint8Array.of(0, 0, 9));
}

function message(csid, type, body, stream = 0) {
  const bytes = [Uint8Array.of(csid), uint(0, 3), uint(body.length, 3), Uint8Array.of(type), uint(stream, 4).reverse(), body.subarray(0, chunkSize)];
  for (let i = chunkSize; i < body.length; i += chunkSize) bytes.push(Uint8Array.of(0xc0 | csid), body.subarray(i, i + chunkSize));
  return concat(...bytes);
}
const control = (type, value, limit = []) => message(2, type, concat(uint(value, 4), Uint8Array.from(limit)));
const command = (name, tx, args, csid = 3, stream = 0) => message(csid, 20, concat(...[name, tx, ...args].map(value => amf(value))), stream);
const status = (code, description) => ({ level: 'status', code, description });
const onStatus = (code, description) => command('onStatus', 0, [null, status(code, description)], 5, 1);
const metadata = {
  duration: 0, fileSize: 0, width: 1920, height: 1080, videocodecid: 7, videodatarate: 6000, framerate: 30,
  audiocodecid: 10, audiodatarate: 160, audiosamplerate: 48000, audiosamplesize: 16, audiochannels: 2,
  stereo: true, encoder: 'obs-output module (libobs version 30.2.3)',
};

// The reference leaves the handshake samples and compressed media unspecified.
const sample = seed => concat(new Uint8Array(8), Uint8Array.from({ length: 1528 }, () => (seed = Math.imul(1664525, seed) + 1013904223 | 0) >>> 24));
const c1 = sample(1), s1 = sample(2), version = Uint8Array.of(3);
const video = (size, config) => message(6, 9, concat(Uint8Array.of(0x17, +!config, 0, 0, 0), new Uint8Array(size)), 1);
const audio = message(4, 8, Uint8Array.of(0xaf, 0, 0x11, 0x90), 1);

const events = [
  ['syn', 0, false, 'tcp', 'SYN', '52630 → 1935 [SYN] Seq=0'],
  ['syn-ack', .017, true, 'tcp', 'SYN-ACK', '1935 → 52630 [SYN, ACK] Seq=0 Ack=1'],
  ['ack', .034, false, 'tcp', 'ACK', '52630 → 1935 [ACK] Seq=1 Ack=1'],
  ['c0-c1', .034, false, 'handshake', 'C0+C1', 'Handshake C0+C1', ['版本 3', '1,536 个随机字节'], concat(version, c1)],
  ['s0-s1-s2', .052, true, 'handshake', 'S0+S1+S2', 'Handshake S0+S1+S2', ['版本 3，自己的字节', '并发回 C1'], concat(version, s1, c1)],
  ['c2', .070, false, 'handshake', 'C2', 'Handshake C2', ['发回 S1'], s1],
  ['connect', .071, false, 'command', 'CONNECT', "Set Chunk Size 4096|connect('live')", ['app: live', '分块大小 4,096'], concat(
    control(1, chunkSize), command('connect', 1, [{ app: 'live', type: 'nonprivate', flashVer: 'FMLE/3.0 (compatible; FMSc/1.0)', swfUrl: url, tcUrl: url }]))],
  ['connected', .089, true, 'reply', '_RESULT', 'Window Ack Size|Set Peer Bandwidth|Set Chunk Size|_result()', ['Connect.Success', '窗口、带宽、分块'], concat(
    control(5, 5000000), control(6, 5000000, [2]), control(1, chunkSize), command('_result', 1, [
      { fmsVer: 'FMS/3,0,1,123', capabilities: 31 }, { ...status('NetConnection.Connect.Success', 'Connection succeeded.'), objectEncoding: 0 },
    ]))],
  ['create-stream', .107, false, 'command', 'CREATESTREAM', 'releaseStream()|FCPublish()|createStream()', ['releaseStream, FCPublish', 'createStream'], concat(
    command('releaseStream', 2, [null, streamKey]), command('FCPublish', 3, [null, streamKey]), command('createStream', 4, [null]))],
  ['stream-created', .125, true, 'reply', '_RESULT', '_result()', ['stream ID 1'], command('_result', 4, [null, 1])],
  ['publish', .143, false, 'command', 'PUBLISH', `publish('${streamKey}')`, ['在 stream 1 上', '推流密钥，live'], command('publish', 5, [null, streamKey, 'live'], 4, 1)],
  ['published', .161, true, 'reply', 'ONSTATUS', "onStatus('NetStream.Publish.Start')", ['Publish.Start'], onStatus('NetStream.Publish.Start', 'Start publishing')],
  ['metadata', .179, false, 'media', '元数据', '@setDataFrame()|Video Data|Audio Data', ['1920×1080, 30 fps', 'H.264 与 AAC 设置'], concat(
    message(4, 18, concat(amf('@setDataFrame'), amf('onMetaData'), amf(metadata, true)), 1), video(40, true), audio)],
  ['key-frame', .180, false, 'media', '关键帧', 'Video Data', ['30 KB of H.264', '8 个分块'], video(30000, false)],
  ['stop', 1834.620, false, 'command', 'DELETESTREAM', 'FCUnpublish()|deleteStream()', ['FCUnpublish', 'deleteStream 1'], concat(
    command('FCUnpublish', 6, [null, streamKey]), command('deleteStream', 7, [null, 1]))],
  ['stopped', 1834.638, true, 'reply', 'ONSTATUS', "onStatus('NetStream.Unpublish.Success')", ['Unpublish.Success'], onStatus('NetStream.Unpublish.Success', 'Stop publishing')],
];

const seq = [3412928760, 673322873];
const initial = [...seq];
const macs = ['00:00:5e:00:53:10', '00:00:5e:00:53:01'];
const ports = [52630, 1935];
const ips = [addresses.client, addresses.web];
const synOptions = [Uint8Array.of(2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2), Uint8Array.of(2, 4, 5, 180, 1, 1, 4, 2, 1, 3, 3, 7)];
let ipId = 0xd825;

export const frames = events.map(([id, time, inbound, category, badgeLabel, summary, badge = [], payload = new Uint8Array()], i) => {
  const a = +inbound, b = 1 - a, src = ips[a], dst = ips[b];
  const count = Math.max(1, Math.ceil(payload.length / mss));
  const segments = Array.from({ length: count }, (_, n) => {
    const data = payload.subarray(n * mss, (n + 1) * mss);
    const flags = [0x02, 0x12, 0x10][i] ?? (n === count - 1 ? 0x18 : 0x10);
    const transport = tcp({ src, dst, srcPort: ports[a], dstPort: ports[b], seq: seq[a], ack: i === 0 ? 0 : seq[b],
      flags, window: flags & 2 ? 64240 : inbound ? 501 : 1026, options: flags & 2 ? synOptions[a] : undefined, payload: data });
    seq[a] += data.length + Number(Boolean(flags & 2));
    return ethernet({ src: macs[a], dst: macs[b], pad: true,
      payload: ipv4({ src, dst, protocol: 6, id: ipId++, ttl: inbound ? 52 : 128, payload: transport }) });
  });
  return {
    id, path: inbound ? inboundPath : path, category, badgeLabel, badge, protocol: i < 3 ? 'TCP' : 'RTMP',
    time: `${time.toFixed(3)}s`, summary: count > 1 ? `${summary}，${count} 个报文段` : summary,
    bytes: concat(...segments), relativeTo: [initial[a], i ? initial[b] : null],
    ...(i >= 3 ? { inspect: inspectRTMP } : {}),
    ...(i === 0 ? { leadMs: 2350 } : {}), ...(category === 'tcp' ? { holdMs: 250 } : {}),
  };
});

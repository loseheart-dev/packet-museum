import { inspectFrame } from '../../lib/bytes/index.js';
import { decode, numberHex, Reader, requireBytes } from '../../lib/bytes/core.js';

function inspectPayload({ bytes, relativeTo }, transport, parse) {
  const decoded = inspectFrame({ bytes, relativeTo });
  const { layers } = decoded;
  const payload = layers.at(-1);
  requireBytes(layers.at(-2)?.label === transport && payload?.label === '载荷', `缺少 ${transport} 载荷`);
  const { offset, length } = payload;
  layers.splice(-1, 1, ...parse(bytes.subarray(offset, offset + length), offset));
  return decoded;
}

export const inspectRTSP = frame => inspectPayload(frame, 'TCP', parseRTSP);
export const inspectRTP = frame => inspectPayload(frame, 'UDP', parseRTP);

function line(r) {
  let end = r.pos;
  while (end < r.bytes.length && r.bytes[end] !== 13 && r.bytes[end] !== 10) end++;
  requireBytes(r.bytes[end] === 13 && r.bytes[end + 1] === 10, `${r.label} 缺少 CRLF`);
  return [decode(r.bytes.subarray(r.pos, end)), end - r.pos + 2];
}

// shortcut: complete RTSP/1.0 messages with optional SDP only; extend for segmented or interleaved connections.
function parseRTSP(bytes, offset) {
  const r = new Reader(bytes, offset, 'RTSP', 'dns');
  const [start, startLength] = line(r);
  requireBytes(/^(?:[A-Z]+ \S+ RTSP\/1\.0|RTSP\/1\.0 \d{3}(?: .*)?)$/.test(start), '无效的 RTSP/1.0 起始行');
  r.slice('起始行', startLength, () => start);
  let contentLength, contentType;
  for (let [value, length] = line(r); value; [value, length] = line(r)) {
    const header = /^([\w-]+):[ \t]*(.*)$/.exec(value);
    requireBytes(header, '无效的 RTSP 首部行');
    const [, name, field] = header;
    r.slice(name, length, () => field);
    if (name.toLowerCase() === 'content-length') {
      requireBytes(contentLength === undefined && /^\d+$/.test(field), '无效的 RTSP Content-Length');
      contentLength = Number(field);
    }
    if (name.toLowerCase() === 'content-type') contentType = field;
  }
  r.slice('首部结束', 2, () => 'CRLF');
  requireBytes((contentLength ?? 0) === r.rest(), 'RTSP 正文长度与 Content-Length 不符');
  if (!r.rest()) return [r.layer()];
  requireBytes(contentType === 'application/sdp', 'RTSP 正文不是 SDP');

  const sdp = new Reader(bytes.subarray(r.pos), offset + r.pos, 'SDP', 'dns');
  while (sdp.rest()) {
    const [value, length] = line(sdp);
    const field = /^([a-z])=(.*)$/.exec(value);
    requireBytes(field, '无效的 SDP 字段');
    sdp.slice(`${field[1]}=`, length, () => field[2]);
  }
  return [r.layer(), sdp.layer()];
}

// shortcut: fixed RTP v2 header and H.264 FU-A IDR fragments; extend when lessons need other payloads or extensions.
function parseRTP(bytes, offset) {
  const r = new Reader(bytes, offset, 'RTP + 视频', 'dns');
  requireBytes(r.number('版本等', 1, () => '2，无填充，无扩展，无 CSRC') === 0x80, '不支持的 RTP 首部');
  const marker = r.number('标记，载荷类型', 1, n => `${n >> 7}、${n & 127}（H.264，与摄像头的描述一致）`);
  requireBytes((marker & 127) === 96, '不支持的 RTP 负载类型');
  r.number('序列号', 2);
  r.number('时间戳', 4);
  r.number('SSRC', 4, n => `0x${n.toString(16).padStart(8, '0').toUpperCase()}`);
  requireBytes(r.number('FU 指示符', 1, () => '0x7c（帧的分片）') === 0x7c, '不是 H.264 FU-A 分片');
  const pieces = { 0x85: '第一块', 0x05: '中间块', 0x45: '最后一块' };
  const fu = r.number('FU 头部', 1, n => `${numberHex(n, 2)}（关键帧的${pieces[n]}）`);
  requireBytes(Object.hasOwn(pieces, fu) && (marker >> 7) === Number(fu === 0x45) && r.rest() > 0, '无效的 H.264 IDR 分片');
  r.slice('视频', r.rest(), b => `关键帧的 ${b.length} 字节`);
  return [r.layer()];
}

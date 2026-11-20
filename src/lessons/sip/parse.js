import { inspectFrame } from '../../lib/bytes/index.js';
import { decode, numberHex, Reader, requireBytes, text } from '../../lib/bytes/core.js';

// shortcut: complete CRLF messages with optional SDP only; extend for folded headers or other bodies.
function parseSIP(bytes, offset) {
  const [headers, body, ...extra] = decode(bytes).split('\r\n\r\n');
  requireBytes(body !== undefined && !extra.length, 'SIP 缺少唯一的首部结束标记');
  const sip = new Reader(bytes, offset, 'SIP', 'dns');
  const [start, ...lines] = headers.split('\r\n');
  requireBytes(/^(?:[A-Z]+ \S+ SIP\/2\.0|SIP\/2\.0 \d{3} [^\r\n]+)$/.test(start), '无效的 SIP 起始行');
  sip.slice('起始行', text(start).length + 2, () => start);
  let length, contentType;
  for (const line of lines) {
    const header = /^([\w-]+):[ \t]*([^\r\n]*)$/.exec(line);
    requireBytes(header, '无效的 SIP 首部');
    const [, name, value] = header;
    if (name.toLowerCase() === 'content-length') {
      requireBytes(length === undefined && /^\d+$/.test(value), '无效的 SIP Content-Length');
      length = Number(value);
    }
    if (name.toLowerCase() === 'content-type') contentType = value;
    sip.slice(name, text(line).length + 2, () => value);
  }
  sip.slice('首部结束', 2);
  requireBytes(length === sip.rest(), 'SIP 正文长度与 Content-Length 不符');
  if (!length) return [sip.layer()];
  requireBytes(contentType === 'application/sdp' && body.endsWith('\r\n'), '无效的 SDP 正文');
  const sdp = new Reader(bytes.subarray(sip.pos), offset + sip.pos, 'SDP', 'dns');
  const names = { v: '版本', o: '来源', s: '会话名称', c: '连接信息', t: '时间', m: '媒体', a: '属性' };
  for (const line of body.slice(0, -2).split('\r\n')) {
    requireBytes(/^[a-z]=[^\r\n]+$/.test(line), '无效的 SDP 字段');
    sdp.slice(`${line[0]}= ${names[line[0]] ?? ''}`.trimEnd(), text(line).length + 2, () => line.slice(2));
  }
  sdp.end();
  return [sip.layer(), sdp.layer()];
}

// shortcut: fixed RTP v2 header and PCMU only; extend when lessons use CSRCs, extensions or other codecs.
function parseRTP(bytes, offset) {
  const rtp = new Reader(bytes, offset, 'RTP', 'dns');
  requireBytes(rtp.number('版本等', 1, () => '2，无填充，无扩展，无 CSRC') === 0x80, '仅支持固定 RTP v2 首部');
  requireBytes((rtp.number('标记，载荷类型', 1, value => `${value >> 7}、0（PCMU：G.711 μ 律，经典的电话编解码器）`) & 0x7f) === 0, '仅支持 PCMU 载荷');
  rtp.number('序列号', 2);
  rtp.number('时间戳', 4);
  rtp.number('SSRC', 4, value => numberHex(value, 8));
  requireBytes(rtp.rest() === 160, 'PCMU 载荷不是 160 字节');
  rtp.slice('音频', 160, () => '160 字节 G.711 音频（20 ms，每个样本一字节）');
  return [rtp.layer()];
}

export function inspectSIP({ bytes, protocol }) {
  const decoded = inspectFrame({ bytes });
  const payload = decoded.layers.at(-1);
  requireBytes(decoded.layers.at(-2)?.label === 'UDP' && payload.label === '载荷', '缺少 UDP 载荷');
  const { offset, length } = payload;
  const parse = protocol === 'RTP' ? parseRTP : parseSIP;
  decoded.layers.splice(-1, 1, ...parse(bytes.subarray(offset, offset + length), offset));
  return decoded;
}

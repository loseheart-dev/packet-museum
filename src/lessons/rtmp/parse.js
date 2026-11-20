import { concat, inspectFrame } from '../../lib/bytes/index.js';
import { decode, hex, Reader, requireBytes, size } from '../../lib/bytes/core.js';

const types = { 1: 'Set Chunk Size', 5: 'Window Acknowledgement Size', 6: 'Set Peer Bandwidth', 8: 'Audio Data', 9: 'Video Data', 18: 'AMF0 Data', 20: 'AMF0 Command' };
const props = { connect: ['命令对象'], _result: ['属性', '信息'], releaseStream: ['命令对象', '推流密钥'],
  FCPublish: ['命令对象', '推流密钥'], createStream: ['命令对象'], publish: ['命令对象', '推流密钥', '发布类型'],
  onStatus: ['命令对象', '信息'], FCUnpublish: ['命令对象', '推流密钥'], deleteStream: ['命令对象', 'Stream ID'] };

function handshake(r, id) {
  if (id !== 'c2') r.number(id === 'c0-c1' ? 'C0：版本' : 'S0：版本', 1);
  const blocks = id === 'c0-c1' ? ['C1'] : id === 'c2' ? ['C2'] : ['S1', 'S2'];
  for (const block of blocks) {
    const echo = block.endsWith('2');
    r.number(`${block} · 时间`, 4);
    r.number(`${block} · ${echo ? '读取时间' : '零'}`, 4);
    r.slice(`${block} · ${echo ? '回显' : '随机数据'}`, 1528, bytes => size(bytes.length));
  }
}

const unsigned = bytes => bytes.reduce((n, b) => n * 256 + b, 0);
const shortString = r => decode(r.read(unsigned(r.read(2))));

function amf(r, label, property = false) {
  const start = r.pos;
  if (property) label = shortString(r);
  const [type] = r.read(1);
  let value;
  const object = type === 3 || type === 8;
  if (type === 0) {
    const bytes = r.read(8);
    value = new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0);
  } else if (type === 1) value = Boolean(r.read(1)[0]);
  else if (type === 2) value = shortString(r);
  else if (type === 5) value = null;
  else if (type === 8) value = `${unsigned(r.read(4))} 项的数组`;
  else requireBytes(type === 3, `不支持的 AMF0 类型: ${type}`);
  const field = { label, offset: r.offset + start, length: r.pos - start, value: object ? value ?? '对象' : JSON.stringify(value) };
  r.fields.push(field);
  if (object) {
    while (!(r.bytes[r.pos] === 0 && r.bytes[r.pos + 1] === 0 && r.bytes[r.pos + 2] === 9)) amf(r, '', true);
    r.slice('对象结束', 3);
  }
  return value;
}

// shortcut: these fixtures use full message headers and only media continuations; extend for interleaved chunks or other header types.
function messages(r, chunkSize) {
  while (r.rest()) {
    const csid = r.number('分块头部', 1, n => `类型 0，分块流 ${n}`);
    requireBytes(csid >= 2 && csid < 64, '不支持的 RTMP 消息头');
    r.number('时间戳', 3, n => `${n} ms`);
    const length = r.number('消息长度', 3, size);
    const type = r.number('消息类型', 1, n => `${n} (${types[n]})`);
    requireBytes(Object.hasOwn(types, type), '未知 RTMP 消息类型');
    r.slice('消息流', 4, bytes => String(new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true)));
    if (type === 8 || type === 9) {
      const video = type === 9;
      const header = video ? 5 : 2;
      requireBytes(length >= header && chunkSize >= header, '无效的 RTMP 媒体头');
      r.number(video ? '帧、编解码器' : '格式', 1, n => `0x${hex(n)} (${video ? 'H.264' : 'AAC'})`);
      r.number(video ? 'AVC 包类型' : 'AAC 包类型', 1, n => n === 0 ? '0（解码器设置）' : String(n));
      if (video) r.number('合成时间', 3);
      r.slice(video ? '视频' : '音频', Math.min(length, chunkSize) - header, bytes => size(bytes.length));
      for (let i = chunkSize; i < length; i += chunkSize) {
        const basic = r.number('分块头部', 1, n => `类型 3，分块流 ${n & 63}`);
        requireBytes(basic === (0xc0 | csid), '无效的 RTMP 续块');
        r.slice(video ? '视频' : '音频', Math.min(chunkSize, length - i), bytes => size(bytes.length));
      }
      continue;
    }
    requireBytes(length <= chunkSize, 'RTMP 控制或 AMF0 消息跨块');
    const offset = r.pos, body = new Reader(r.read(length), offset, r.label, r.color);
    if (type === 1) {
      chunkSize = body.number('分块大小', 4, size);
      requireBytes(chunkSize > 0 && chunkSize <= 0x7fffffff, '无效的 RTMP 分块大小');
    } else if (type === 5) body.number('窗口', 4, size);
    else if (type === 6) { body.number('带宽', 4, size); body.number('限制', 1, n => n === 2 ? '2（动态）' : String(n)); }
    else if (type === 18) for (const label of ['处理程序', '事件', '元数据']) amf(body, label);
    else if (type === 20) {
      const command = amf(body, '命令');
      const tx = amf(body, '事务 ID');
      const labels = command === '_result' && tx === 4 ? ['命令对象', 'Stream ID'] : props[command];
      requireBytes(labels, '未知 RTMP 命令');
      for (const label of labels) amf(body, label);
    }
    body.end();
    r.fields.push(...body.fields);
  }
}

export function inspectRTMP({ bytes, id, relativeTo }) {
  const segments = [], payloads = [];
  let offset = 0;
  while (offset < bytes.length) {
    const length = 14 + bytes[offset + 16] * 256 + bytes[offset + 17];
    requireBytes(length >= 54 && offset + length <= bytes.length, '无效的 RTMP 以太网帧长度');
    const info = inspectFrame({ bytes: bytes.subarray(offset, offset + length), relativeTo });
    const payload = info.layers.pop();
    requireBytes(payload.label === '载荷', 'RTMP TCP 段缺少载荷');
    payloads.push(bytes.subarray(offset + payload.offset, offset + length));
    segments.push({ ...info, offset, payload });
    offset += length;
  }

  // Keep the reference's one row per event while preserving each on-wire frame and its byte offsets.
  const r = new Reader(concat(...payloads), 0, 'RTMP', 'dns');
  if (['c0-c1', 's0-s1-s2', 'c2'].includes(id)) handshake(r, id);
  else {
    // Each direction negotiates the larger chunk size during connect.
    const initialChunkSize = ['connect', 'connected'].includes(id) ? 128 : 4096;
    messages(r, initialChunkSize);
  }
  r.end();

  let start = 0;
  const layers = segments.flatMap(({ layers, offset, payload }) => {
    const end = start + payload.length;
    const absolute = offset + payload.offset;
    const fields = r.fields.flatMap(field => {
      const left = Math.max(start, field.offset), right = Math.min(end, field.offset + field.length);
      return right > left ? [{ ...field, offset: absolute + left - start, length: right - left }] : [];
    });
    start = end;
    return [...layers.map(layer => ({ ...layer, offset: layer.offset + offset,
      fields: layer.fields.map(field => ({ ...field, offset: field.offset + offset })) })),
    { label: r.label, color: r.color, offset: absolute, length: payload.length, fields }];
  });
  const [{ src, dst, link }] = segments;
  return { layers, src, dst, link };
}

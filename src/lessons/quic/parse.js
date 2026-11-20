import { inspectFrame } from '../../lib/bytes/index.js';
import { Reader, requireBytes } from '../../lib/bytes/core.js';

const types = { 0xc0: 'Initial', 0xe0: 'Handshake', 0x40: '1-RTT' };
const count = value => `${value.toLocaleString('en-US')} 字节`;

// shortcut: v1 lesson packets use 8-byte short-header CIDs and a 1-byte protected packet number; use connection context for captures.
export function inspectQUIC({ bytes, quic }) {
  const decoded = inspectFrame({ bytes });
  const payload = decoded.layers.pop();
  requireBytes(decoded.layers.at(-1)?.label === 'UDP' && payload.label === '载荷', 'QUIC 缺少 UDP 载荷');
  const end = payload.offset + payload.length;
  let offset = payload.offset;
  for (const { type, number, sealed, inner } of quic) {
    const r = new Reader(bytes.subarray(offset, end), offset, `QUIC · ${type}`, 'dns');
    const flags = r.number('头部类型', 1, value => value & 0x80 ? `长头部，${type}` : '短头部');
    const long = Boolean(flags & 0x80);
    requireBytes(types[flags & (long ? 0xf0 : 0xc0)] === type, 'QUIC 头部类型与示例不符');
    let length = r.bytes.length - 9;
    if (long) {
      requireBytes(r.number('版本', 4) === 1, 'QUIC 仅支持版本 1');
      for (const label of ['目标连接 ID', '源连接 ID']) {
        const size = r.number(`${label} 长度`, 1);
        requireBytes(size <= 20, 'QUIC 连接 ID 过长');
        r.slice(label, size);
      }
      if (type === 'Initial') requireBytes(r.number('令牌长度', 1) === 0, 'QUIC 示例不含令牌');
      const encoded = r.number('长度', 2, value => count(value & 0x3fff));
      requireBytes((encoded >>> 14) === 1, 'QUIC 示例长度字段须为 2 字节');
      length = encoded & 0x3fff;
    } else {
      r.slice('目标连接 ID', 8);
    }
    requireBytes(length === sealed + 1, 'QUIC 长度与示例不符');
    r.slice('包号', 1, () => `${number}（已隐藏，示例）`);
    r.slice('加密载荷', length - 1, b => `${count(b.length)}（示例） · 内部：${inner.join('；')}`);
    decoded.layers.push(r.layer());
    offset += r.pos;
  }
  requireBytes(offset === end, 'QUIC 数据报有剩余字节');
  return decoded;
}

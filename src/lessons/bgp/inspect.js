import { inspectFrame } from '../../lib/bytes/index.js';
import { Reader, hexText, ipText, requireBytes, size } from '../../lib/bytes/core.js';

const types = { 1: 'OPEN', 2: 'UPDATE', 4: 'KEEPALIVE' };
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function block(r, length, parse) {
  const offset = r.offset + r.pos;
  const part = new Reader(r.read(length), offset, r.label, r.color);
  parse(part);
  part.end();
  r.fields.push(...part.fields);
}

function capabilities(r) {
  while (r.rest()) {
    const [code, length] = r.bytes.subarray(r.pos, r.pos + 2);
    r.slice(({ 1: '多协议', 2: '路由刷新', 65: '4 字节 AS 号' })[code] ?? `能力 ${code}`, 2 + length, bytes => {
      const data = bytes.subarray(2);
      if (code === 1) {
        requireBytes(length === 4, 'BGP 多协议能力长度无效');
        return view(data).getUint16(0) === 1 && data[3] === 1 ? 'IPv4 unicast' : hexText(data);
      }
      if (code === 2) {
        requireBytes(length === 0, 'BGP 路由刷新能力长度无效');
        return '是';
      }
      if (code === 65) {
        requireBytes(length === 4, 'BGP 4 字节 AS 能力长度无效');
        return `是，AS ${view(data).getUint32(0)}`;
      }
      return hexText(bytes);
    });
  }
}

function open(r) {
  requireBytes(r.number('版本', 1) === 4, 'BGP 版本不是 4');
  r.number('My AS', 2);
  r.number('保持时间', 2, n => `${n} s`);
  r.slice('BGP 标识符', 4, ipText);
  block(r, r.number('可选参数', 1, size), options => {
    while (options.rest()) {
      const [type, length] = options.bytes.subarray(options.pos, options.pos + 2);
      if (type !== 2) options.slice(`参数 ${type}`, 2 + length);
      else {
        options.slice('支持的功能', 2, () => `parameter 2, ${size(length)}`);
        block(options, length, capabilities);
      }
    }
  });
}

function prefixes(r, label) {
  while (r.rest()) {
    const bits = r.bytes[r.pos];
    requireBytes(bits <= 32, 'BGP IPv4 前缀长度无效');
    r.slice(label, 1 + Math.ceil(bits / 8), bytes => {
      const address = new Uint8Array(4);
      address.set(bytes.subarray(1));
      if (bits % 8) address[bits >> 3] &= 0xff << (8 - bits % 8);
      return `${ipText(address)}/${bits}`;
    });
  }
}

function attributes(r) {
  while (r.rest()) {
    const [flags, code, high, low] = r.bytes.subarray(r.pos, r.pos + 4);
    const extended = (flags & 0x10) !== 0;
    const header = extended ? 4 : 3;
    const length = extended ? high * 256 + low : high;
    r.slice(({ 1: 'ORIGIN', 2: 'AS_PATH', 3: 'NEXT_HOP' })[code] ?? `路径属性 ${code}`, header + length, bytes => {
      const data = bytes.subarray(header);
      if (code === 1) {
        requireBytes(length === 1 && data[0] <= 2, 'BGP ORIGIN 无效');
        return ['0（IGP：来自宣告它的网络内部）', '1 (EGP)', '2 (INCOMPLETE)'][data[0]];
      }
      if (code === 2) {
        // shortcut: the lesson uses one four-octet AS_SEQUENCE; add negotiated widths and segment types for other captures.
        if (!length) return '';
        requireBytes(data[0] === 2 && length === 2 + 4 * data[1], 'BGP AS_PATH 无效或不在课程支持范围内');
        const path = view(data);
        return Array.from({ length: data[1] }, (_, i) => path.getUint32(2 + 4 * i)).join(' ');
      }
      if (code === 3) {
        requireBytes(length === 4, 'BGP NEXT_HOP 长度无效');
        return ipText(data);
      }
      return hexText(bytes);
    });
  }
}

export function inspectBGP({ inspect: _, ...frame }) {
  const packet = inspectFrame(frame);
  const { layers } = packet;
  const payload = layers.at(-1);
  requireBytes(payload?.label === '载荷' && layers.at(-2)?.label === 'TCP', '缺少 BGP TCP 载荷');
  const { offset, length } = payload;
  // shortcut: each course segment carries exactly one BGP message; use reassembly for split or coalesced captures.
  const r = new Reader(frame.bytes.subarray(offset, offset + length), offset, 'BGP', 'dns');
  requireBytes(r.slice('标记', 16, () => '16 字节的 0xFF').every(byte => byte === 0xff), 'BGP 标记无效');
  requireBytes(r.number('长度', 2, size) === length, 'BGP 消息长度与载荷不一致');
  const type = r.number('类型', 1, n => `${n} (${types[n] ?? '?'})`);
  requireBytes(Object.hasOwn(types, type), 'BGP 消息类型不在课程支持范围内');
  r.label = `BGP · ${types[type]}`;
  if (type === 1) open(r);
  if (type === 2) {
    const withdrawn = r.number('撤销的路由', 2, size);
    block(r, withdrawn, part => prefixes(part, '已撤销'));
    const length = r.number('路径属性', 2, size);
    block(r, length, attributes);
    if (withdrawn && !length && !r.rest()) r.label = 'BGP · UPDATE（撤销）';
    prefixes(r, '可达');
  }
  r.end();
  layers[layers.length - 1] = r.layer();
  return packet;
}

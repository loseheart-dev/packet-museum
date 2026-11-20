import { inspectFrame } from '../../lib/bytes/index.js';
import { decode, Reader, requireBytes, size } from '../../lib/bytes/core.js';

const opcodes = { 1: 'text', 8: 'close', 9: 'ping', 10: 'pong' };

export function applyMask(bytes, key) {
  return bytes.map((byte, i) => byte ^ key[i % 4]);
}

// shortcut: one complete, uncompressed frame with a short length; extend for fragmented or larger messages.
export function inspectWebSocket({ bytes, relativeTo }) {
  const decoded = inspectFrame({ bytes, relativeTo });
  const index = decoded.layers.findIndex(layer => layer.label === '载荷');
  requireBytes(decoded.layers[index - 1]?.label === 'TCP', 'WebSocket 缺少 TCP 载荷');
  const { offset, length } = decoded.layers[index];
  const r = new Reader(bytes.subarray(offset, offset + length), offset, 'WebSocket', 'dns');
  const first = r.number('FIN, opcode', 1, n => `${n >> 7}, ${n & 15} (${opcodes[n & 15]})`);
  const opcode = first & 15;
  requireBytes((first & 0xf0) === 0x80 && Object.hasOwn(opcodes, opcode), '不支持的 WebSocket FIN、RSV 或 opcode');
  const second = r.number('掩码、长度', 1, n => `${n & 128 ? '已掩码' : '未掩码'}，${n & 127} 字节`);
  const count = second & 127;
  requireBytes(count <= 125 && (opcode !== 8 || count === 0 || count === 2), '不支持的 WebSocket 载荷长度');
  const key = second & 128 ? r.slice('掩码密钥', 4) : null;
  r.slice(opcode === 8 ? '状态码' : '载荷', count, wire => {
    const plain = key ? applyMask(wire, key) : wire;
    if (opcode === 8) {
      const code = plain[0] * 256 + plain[1];
      return code === 1000 ? '1000（正常关闭）' : String(code);
    }
    return opcode === 1 ? `"${decode(plain)}" (${size(plain.length)})` : size(plain.length);
  });
  r.end();
  decoded.layers[index] = r.layer();
  return decoded;
}

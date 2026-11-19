import { checksum, concat, empty, ipv4Address, ipText, macAddress, macText, numberHex, requireBytes, size, transportChecksum, uint } from './core.js';

export const ethernet = ({ src, dst, type = 0x0800, payload, pad = false }) => concat(macAddress(dst), macAddress(src), uint(type, 2), payload,
  pad ? new Uint8Array(Math.max(0, 46 - payload.length)) : empty);

export function arp({ operation, senderMac, senderIp, targetMac = '00:00:00:00:00:00', targetIp }) {
  return concat(uint(1, 2), uint(0x0800, 2), uint(6, 1), uint(4, 1), uint(operation, 2),
    macAddress(senderMac), ipv4Address(senderIp), macAddress(targetMac), ipv4Address(targetIp));
}

export function ipv4({ src, dst, protocol, payload, id = 0, ttl = 64, flags = 0x4000, dscp = 0, options = empty }) {
  requireBytes(options.length % 4 === 0 && options.length <= 40, 'IPv4 选项必须按 4 字节对齐');
  const header = concat(uint(0x45 + options.length / 4, 1), uint(dscp, 1), uint(20 + options.length + payload.length, 2),
    uint(id, 2), uint(flags, 2), uint(ttl, 1), uint(protocol, 1), uint(0, 2), ipv4Address(src), ipv4Address(dst), options);
  header.set(uint(checksum(header), 2), 10);
  return concat(header, payload);
}

export function udp({ src, dst, srcPort, dstPort, payload = empty }) {
  const bytes = concat(uint(srcPort, 2), uint(dstPort, 2), uint(8 + payload.length, 2), uint(0, 2), payload);
  bytes.set(uint(transportChecksum(src, dst, 17, bytes) || 0xffff, 2), 6);
  return bytes;
}

export function tcp({ src, dst, srcPort, dstPort, seq = 0, ack = 0, flags = 0, window = 4096, urgent = 0, options = empty, payload = empty }) {
  requireBytes(options.length % 4 === 0 && options.length <= 40 && Number.isInteger(flags) && flags >= 0 && flags <= 511, '无效的 TCP 选项长度或标志');
  const bytes = concat(uint(srcPort, 2), uint(dstPort, 2), uint(seq, 4), uint(ack, 4),
    uint(((5 + options.length / 4) << 12) | flags, 2), uint(window, 2), uint(0, 2), uint(urgent, 2), options, payload);
  bytes.set(uint(transportChecksum(src, dst, 6, bytes), 2), 16);
  return bytes;
}

export function parseEthernet(r) {
  const dst = macText(r.slice('目的地址', 6, macText));
  const src = macText(r.slice('源地址', 6, macText));
  const type = r.number('类型', 2, numberHex);
  return { src, dst, next: { 0x0800: 'ipv4', 0x0806: 'arp' }[type] ?? 'raw' };
}

export function parseArp(r) {
  const hardware = r.number('硬件类型', 2);
  const protocol = r.number('协议类型', 2, numberHex);
  const hl = r.number('硬件地址长度', 1);
  const pl = r.number('协议地址长度', 1);
  const operation = r.number('操作', 2, n => ({ 1: '1 · 请求', 2: '2 · 应答' })[n] ?? n);
  requireBytes(hardware === 1 && protocol === 0x0800 && hl === 6 && pl === 4, '只支持 Ethernet / IPv4 ARP');
  r.slice('发送方 MAC', hl, macText);
  const src = ipText(r.slice('发送方 IPv4', pl, ipText));
  r.slice('目标 MAC', hl, macText);
  const dst = ipText(r.slice('目标 IPv4', pl, ipText));
  r.end();
  return { src, dst, operation };
}

export function parseIPv4(r) {
  const ihl = (r.number('版本，头部长度', 1, n => `${n >> 4} / ${(n & 15) * 4} B`) & 15) * 4;
  requireBytes(r.bytes[0] >> 4 === 4 && ihl >= 20, '无效的 IPv4 版本或 IHL');
  r.number('DSCP, ECN', 1, n => `${n >> 2}, ${n & 3}`);
  const length = r.number('总长度', 2, size);
  r.number('标识', 2, numberHex);
  const flags = r.number('标志', 2, n => `DF=${(n >> 14) & 1} · MF=${(n >> 13) & 1} · 偏移 ${n & 8191}`);
  r.number('生存时间', 1);
  const protocol = r.number('协议', 1, n => ({ 6: '6 · TCP', 17: '17 · UDP' })[n] ?? n);
  r.number('头部校验和', 2, numberHex);
  const src = ipText(r.slice('源地址', 4, ipText));
  const dst = ipText(r.slice('目的地址', 4, ipText));
  r.slice('选项', ihl - 20);
  requireBytes(length === r.bytes.length, 'IPv4 总长度与字节范围不符');
  requireBytes(checksum(r.bytes.subarray(0, ihl)) === 0, 'IPv4 头部校验和错误');
  return { src, dst, fragmented: Boolean(flags & 0x3fff), next: flags & 0x3fff ? 'raw' : ({ 6: 'tcp', 17: 'udp' })[protocol] ?? 'raw' };
}

export function parseUDP(r, addresses) {
  r.number('源端口', 2);
  r.number('目的端口', 2);
  const length = r.number('长度', 2, size);
  const checksumValue = r.number('校验和', 2, numberHex);
  requireBytes(length === r.bytes.length, 'UDP 长度与字节范围不符');
  requireBytes(checksumValue && addresses && transportChecksum(addresses.src, addresses.dst, 17, r.bytes) === 0, 'UDP 伪首部校验和错误或缺少 IPv4 地址');
}

export function parseTCP(r, addresses, relativeTo) {
  r.number('源端口', 2);
  r.number('目的端口', 2);
  r.number('序列号', 4);
  r.number('确认号', 4);
  const words = r.number('数据偏移', 1, n => size((n >> 4) * 4)) >> 4;
  r.number('标志', 1, n => ['FIN', 'SYN', 'RST', 'PSH', 'ACK', 'URG', 'ECE', 'CWR'].filter((_, i) => n & (1 << i)).join(' · ') || numberHex(n, 2));
  r.number('窗口', 2);
  r.number('校验和', 2, numberHex);
  r.number('紧急指针', 2);
  requireBytes(words >= 5, '无效的 TCP 数据偏移');
  const end = words * 4;
  requireBytes(end <= r.bytes.length, 'TCP 缺少选项字节');
  while (r.pos < end) {
    const kind = r.bytes[r.pos];
    if (kind === 0 || kind === 1) {
      r.number(kind === 0 ? '选项结束' : 'NOP', 1);
      if (kind === 0) r.slice('选项填充', end - r.pos);
      continue;
    }
    const length = r.bytes[r.pos + 1];
    requireBytes(length >= 2 && r.pos + length <= end, '无效的 TCP 选项长度');
    const expected = { 2: 4, 3: 3, 4: 2, 8: 10 }[kind];
    requireBytes(!expected || length === expected, '无效的 TCP 选项长度');
    requireBytes(kind !== 5 || (length >= 10 && (length - 2) % 8 === 0), '无效的 TCP SACK 长度');
    const label = { 2: 'MSS', 3: '窗口缩放', 4: 'SACK Permitted', 5: 'SACK', 8: '时间戳' }[kind] ?? `选项 ${kind}`;
    r.slice(label, length, b => {
      const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
      if (kind === 2) return size(view.getUint16(2));
      if (kind === 3) return `shift ${b[2]} · ×${2 ** b[2]}`;
      if (kind === 4) return '允许';
      if (kind === 5) return Array.from({ length: (length - 2) / 8 }, (_, i) => {
        const left = view.getUint32(2 + i * 8), right = view.getUint32(6 + i * 8), base = relativeTo?.[1];
        const absolute = `[${left}, ${right})`;
        return base == null ? absolute : `已有 ${(left - base) >>> 0}–${(right - base - 1) >>> 0}（相对） · ${absolute}`;
      }).join(' · ');
      if (kind === 8) return `TSval ${view.getUint32(2)} · TSecr ${view.getUint32(6)}`;
      return Array.from(b.subarray(2), n => numberHex(n, 2)).join(' ');
    });
  }
  requireBytes(addresses && transportChecksum(addresses.src, addresses.dst, 6, r.bytes) === 0, 'TCP 伪首部校验和错误或缺少 IPv4 地址');
}

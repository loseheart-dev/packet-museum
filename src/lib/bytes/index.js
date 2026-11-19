import { concat, Reader, requireBytes, size } from './core.js';
import { parseEthernet, parseArp, parseIPv4, parseUDP, parseTCP } from './network.js';
import { parseDNS } from './dns.js';
import { parseDHCP, parseHTTP } from './application.js';
import { parseTLS, parseHandshake } from './tls.js';

export { concat, ipv4Address, macAddress, text, uint } from './core.js';
export { ethernet, arp, ipv4, udp, tcp } from './network.js';
export { dns } from './dns.js';
export { dhcp, http } from './application.js';
export { tlsRecord, tlsHandshake, tlsExtension, tlsHello } from './tls.js';

const layersByFormat = {
  ethernet: ['Ethernet II', 'ether', parseEthernet], arp: ['ARP', 'ether', parseArp], ipv4: ['IPv4', 'ip', parseIPv4],
  udp: ['UDP', 'udp', parseUDP], tcp: ['TCP', 'ip', parseTCP], dns: ['DNS', 'dns', parseDNS],
  dhcp: ['DHCP', 'dns', parseDHCP], http: ['HTTP', 'dns', parseHTTP], tls: ['TLS', 'dns', parseTLS],
  handshake: ['TLS Handshake', 'dns', parseHandshake], raw: ['载荷', 'ip', r => r.slice('载荷', r.rest(), b => size(b.length))]
};
const applications = ['dns', 'dhcp', 'http', 'tls', 'handshake', 'raw'];

export function inspectFrame({ bytes, format = 'ethernet', application, addresses, fieldNames, relativeTo }) {
  requireBytes(bytes instanceof Uint8Array && bytes.length > 0, '帧必须是非空 Uint8Array');
  requireBytes(!application || applications.includes(application), `未知应用协议: ${application}`);
  const layers = [];
  let offset = 0, end = bytes.length, src = addresses?.src, dst = addresses?.dst, link;
  while (format) {
    requireBytes(Object.hasOwn(layersByFormat, format), `未知帧格式: ${format}`);
    const [label, color, parse] = layersByFormat[format];
    const r = new Reader(bytes.subarray(offset, end), offset, label, color);
    const result = parse(r, addresses, relativeTo);
    requireBytes(r.pos > 0, `${label} 缺少内容`);
    layers.push(r.layer());
    if (format === 'tcp' && relativeTo) for (const [i, base] of relativeTo.entries()) {
      if (base === null) continue;
      const field = r.fields[2 + i];
      field.value = `${(Number(field.value) - base) >>> 0}（相对） · ${field.value}（绝对）`;
    }
    if ((format === 'tls' || format === 'handshake') && fieldNames) {
      for (const field of r.fields) field.label = Object.hasOwn(fieldNames, field.label) ? fieldNames[field.label] : field.label;
    }
    offset += r.pos;
    if (result?.src) ({ src, dst } = result);
    if (format === 'ethernet') {
      link = { src, dst };
      const payloadEnd = result.next === 'arp' ? offset + 28 : result.next === 'ipv4' && end >= offset + 4 ? offset + bytes[offset + 2] * 256 + bytes[offset + 3] : end;
      if (end === 60 && payloadEnd < end) end = payloadEnd;
    }
    if (format === 'ipv4') addresses = { src, dst };
    if (result?.next) {
      requireBytes(!result.fragmented || !application, '无法从单个 IPv4 分片解码应用层');
      format = result.next;
    } else if (!applications.includes(format)) {
      format = application ?? (offset < end ? 'raw' : null);
      application = undefined;
    } else format = null;
    if (format === 'raw' && offset === end) format = null;
  }
  requireBytes(!application && offset === end, '帧的封装与应用协议不匹配或有剩余字节');
  if (end < bytes.length) {
    const r = new Reader(bytes.subarray(end), end, 'Padding', 'ether');
    r.slice('以太网填充', r.rest());
    layers.push(r.layer());
  }
  return { layers, src, dst, link };
}

// shortcut: only contiguous, in-order segments from one direction; upgrade if captures need gap or retransmission handling.
export function reassembleTCP(segments, application, fieldNames) {
  requireBytes(segments.length > 1 && applications.includes(application), '需要多个 TCP 段和已知的应用协议');
  let expected, flow;
  const bytes = concat(...segments.map(({ bytes, layers, src, dst }) => {
    const tcp = layers.find(layer => layer.label === 'TCP');
    const payload = layers.find(layer => layer.label === '载荷');
    requireBytes(tcp && payload, '重组需要带载荷的 TCP 段');
    const header = new DataView(bytes.buffer, bytes.byteOffset + tcp.offset, tcp.length);
    const seq = header.getUint32(4), key = `${src}:${header.getUint16(0)}>${dst}:${header.getUint16(2)}`;
    requireBytes((flow ??= key) === key && (expected ?? seq) === seq, 'TCP 段必须同方向且序号连续');
    expected = (seq + payload.length) >>> 0;
    return bytes.subarray(payload.offset, payload.offset + payload.length);
  }));
  return { bytes, ...inspectFrame({ bytes, format: application, fieldNames }), src: segments[0].src, dst: segments[0].dst };
}

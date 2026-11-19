import { Reader, requireBytes, size } from './core.js';
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

export function inspectFrame({ bytes, format = 'ethernet', application, addresses }) {
  requireBytes(bytes instanceof Uint8Array && bytes.length > 0, '帧必须是非空 Uint8Array');
  requireBytes(!application || applications.includes(application), `未知应用协议: ${application}`);
  const layers = [];
  let offset = 0, src = addresses?.src, dst = addresses?.dst;
  while (format) {
    requireBytes(Object.hasOwn(layersByFormat, format), `未知帧格式: ${format}`);
    const [label, color, parse] = layersByFormat[format];
    const r = new Reader(bytes.subarray(offset), offset, label, color);
    const result = parse(r, addresses);
    requireBytes(r.pos > 0, `${label} 缺少内容`);
    layers.push(r.layer());
    offset += r.pos;
    if (result?.src) ({ src, dst } = result);
    if (format === 'ipv4') addresses = { src, dst };
    if (result?.next) {
      requireBytes(!result.fragmented || !application, '无法从单个 IPv4 分片解码应用层');
      format = result.next;
    } else if (!applications.includes(format)) {
      format = application ?? (offset < bytes.length ? 'raw' : null);
      application = undefined;
    } else format = null;
    if (format === 'raw' && offset === bytes.length) format = null;
  }
  requireBytes(!application && offset === bytes.length, '帧的封装与应用协议不匹配或有剩余字节');
  return { layers, src, dst };
}

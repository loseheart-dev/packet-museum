import { concat, ethernet, macAddress, uint } from '../../lib/bytes/index.js';
import { checksum, macText, numberHex, Reader, requireBytes, size } from '../../lib/bytes/core.js';
import { parseEthernet } from '../../lib/bytes/network.js';
import { badges } from './copy.js';

const clientMac = '00:00:5e:00:53:10', routerMac = '00:00:5e:00:53:01';
const prefix = '2001:db8:1234:5678::', dns = '2001:4860:4860::8888';
const global = '2001:db8:1234:5678:8d2e:4f61:a9b0:7c13', solicited = 'ff02::1:ffb0:7c13';
export const linkLocal = 'fe80::8d2e:4f61:a9b0:7c13', router = 'fe80::1';

const address = value => {
  const [first, last = []] = value.split('::').map(part => part ? part.split(':') : []);
  return concat(...[...first, ...Array(8 - first.length - last.length).fill('0'), ...last].map(word => uint(parseInt(word, 16), 2)));
};
const addressText = bytes => {
  const words = Array.from({ length: 8 }, (_, i) => (bytes[2 * i] * 256 + bytes[2 * i + 1]).toString(16)).join(':');
  const run = [...words.matchAll(/(?<![\da-f])0(?::0)+(?![\da-f])/g)].sort((a, b) => b[0].length - a[0].length)[0];
  return run ? `${words.slice(0, run.index).replace(/:$/, '')}::${words.slice(run.index + run[0].length).replace(/^:/, '')}` : words;
};
const u8 = n => uint(n, 1), u16 = n => uint(n, 2), u32 = n => uint(n, 4);
const icmpChecksum = (src, dst, bytes) => checksum(concat(src, dst, u32(bytes.length), u32(58), bytes));
const multicastMac = dst => macText(concat(Uint8Array.of(0x33, 0x33), dst.subarray(12)));
const linkOption = (type, mac) => concat(Uint8Array.of(type, 1), macAddress(mac));
const solicit = target => concat(u32(0), address(target));
const messages = {
  133: 'Router Solicitation', 134: 'Router Advertisement', 135: 'Neighbor Solicitation', 136: 'Neighbor Advertisement',
};

function wire(src, dst, fromRouter, type, body) {
  const srcIp = address(src), dstIp = address(dst);
  const message = concat(u8(type), u8(0), u16(0), body);
  message.set(u16(icmpChecksum(srcIp, dstIp, message)), 2);
  return ethernet({ src: fromRouter ? routerMac : clientMac, dst: dstIp[0] === 255 ? multicastMac(dstIp) : routerMac,
    type: 0x86dd, payload: concat(u32(0x60000000), u16(message.length), Uint8Array.of(58, 255), srcIp, dstIp, message) });
}

const packets = [
  ['0.000s', '::', solicited, false, 135, `for ${linkLocal}`, solicit(linkLocal)],
  ['1.010s', linkLocal, 'ff02::2', false, 133, `from ${clientMac}`, concat(u32(0), linkOption(1, clientMac))],
  ['1.012s', router, 'ff02::1', true, 134, `from ${routerMac}`, concat(
    Uint8Array.of(64, 0), u16(1800), u32(0), u32(0), linkOption(1, routerMac),
    Uint8Array.of(5, 1, 0, 0), u32(1500),
    Uint8Array.of(3, 4, 64, 0xc0), u32(86400), u32(14400), u32(0), address(prefix),
    Uint8Array.of(25, 3, 0, 0), u32(3600), address(dns))],
  ['1.020s', '::', solicited, false, 135, `for ${global}`, solicit(global)],
  ['2.500s', router, solicited, true, 135, `for ${global} from ${routerMac}`, concat(solicit(global), linkOption(1, routerMac))],
  ['2.502s', linkLocal, router, false, 136, `${global} (sol, ovr) is at ${clientMac}`,
    concat(u32(0x60000000), address(global), linkOption(2, clientMac))],
];

export const frames = packets.map(([time, src, dst, fromRouter, type, info, body], i) => ({
  id: `ipv6-${i + 1}`, time, protocol: 'ICMPv6', summary: `${messages[type]} ${info}`, badge: badges[i],
  path: fromRouter ? ['router', 'client'] : ['client', 'router'], category: fromRouter ? 'router' : 'client',
  bytes: wire(src, dst, fromRouter, type, body), inspect: inspectIPv6,
  ...(i === 0 ? { leadMs: 2400, holdMs: 2100 } : i === 3 ? { holdMs: 2100 } : {}),
}));

// shortcut: only the IPv6/NDP headers and options used by this lesson; extend when adding other traffic.
function inspectIPv6({ bytes }) {
  requireBytes(bytes instanceof Uint8Array, '帧必须是 Uint8Array');
  const ethernet = new Reader(bytes, 0, 'Ethernet II', 'ether');
  const { src: srcMac, dst: dstMac } = parseEthernet(ethernet);
  requireBytes(bytes[12] === 0x86 && bytes[13] === 0xdd, '不是 IPv6 以太网帧');
  const ip = new Reader(bytes.subarray(14), 14, 'IPv6', 'ip');
  const version = ip.number('版本、类别、流', 4, n => `${n >>> 28}, ${(n >>> 20) & 255}, ${n & 0xfffff}`);
  const length = ip.number('载荷长度', 2, size);
  const next = ip.number('下一个头部', 1, n => `${n} (ICMPv6)`);
  const hops = ip.number('跳数限制', 1);
  const src = ip.slice('源地址', 16, addressText), dst = ip.slice('目的地址', 16, addressText);
  requireBytes(version >>> 28 === 6 && length === ip.rest() && next === 58 && hops === 255, '无效的 IPv6 邻居发现首部');
  requireBytes(dst[0] !== 255 || dstMac === multicastMac(dst), 'IPv6 多播 MAC 地址不匹配');
  const icmp = new Reader(ip.bytes.subarray(ip.pos), 54, 'ICMPv6', 'udp');
  const type = icmp.number('类型', 1, n => `${n} (${messages[n]})`);
  const code = icmp.number('代码', 1);
  icmp.number('校验和', 2, numberHex);
  requireBytes(Object.hasOwn(messages, type) && code === 0, '无效的 ICMPv6 邻居发现类型或代码');
  requireBytes(icmpChecksum(src, dst, icmp.bytes) === 0, 'ICMPv6 伪首部校验和错误');
  if (type === 134) {
    icmp.number('跳数限制', 1);
    icmp.number('标志', 1, n => `${numberHex(n, 2)}: M ${n >>> 7}, O ${(n >>> 6) & 1}`);
    icmp.number('路由器生存期', 2, n => `${n.toLocaleString('en-US')} s`);
    icmp.number('可达时间', 4, n => n || '0（未设置）');
    icmp.number('重传计时器', 4, n => n || '0（未设置）');
  } else {
    if (type === 136) icmp.number('标志', 4, n => {
      const flags = ['路由器', '应请求', '覆盖'].filter((_, i) => n & (0x80000000 >>> i));
      return `${numberHex(n, 8)}${flags.length ? `：${flags.join('，')}` : ''}`;
    });
    else icmp.number('保留', 4);
    if (type !== 133) icmp.slice('目标', 16, addressText);
  }
  while (icmp.rest()) {
    const kind = icmp.bytes[icmp.pos], length = icmp.bytes[icmp.pos + 1] * 8;
    const expected = { 1: 8, 2: 8, 3: 32, 5: 8, 25: 24 }[kind];
    requireBytes(expected && length === expected, '无效的 ICMPv6 邻居发现选项长度');
    if (kind === 1 || kind === 2) icmp.slice(kind === 1 ? '源链路层地址' : '目标链路层地址', length, b => macText(b.subarray(2)));
    else icmp.slice({ 3: '前缀', 5: 'MTU', 25: 'DNS 服务器' }[kind], length, b => {
      const view = new DataView(b.buffer, b.byteOffset, b.length);
      const seconds = offset => view.getUint32(offset).toLocaleString('en-US');
      if (kind === 3) return `${addressText(b.subarray(16))}/${b[2]}，有效期 ${seconds(4)} s，首选期 ${seconds(8)} s`;
      if (kind === 25) return `${addressText(b.subarray(8))}，有效 ${seconds(4)} s`;
      return size(view.getUint32(4));
    });
  }
  return { layers: [ethernet.layer(), ip.layer(), icmp.layer()], src: addressText(src), dst: addressText(dst), link: { src: srcMac, dst: dstMac } };
}

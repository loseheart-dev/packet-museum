import { arp, ethernet, ipv4, tcp } from '../../lib/bytes/index.js';

const clientMac = '00:00:5e:00:53:10', nasMac = '00:00:5e:00:53:20';
const routerMac = '00:00:5e:00:53:01', uplinkMac = '00:00:5e:00:53:02', ispMac = '00:00:5e:00:53:fe';
const clientIp = '192.168.1.10', nasIp = '192.168.1.20', publicIp = '198.51.100.7', webIp = '203.0.113.10';
const broadcast = 'ff:ff:ff:ff:ff:ff';

const request = ethernet({ src: clientMac, dst: broadcast, type: 0x0806, pad: true,
  payload: arp({ operation: 1, senderMac: clientMac, senderIp: clientIp, targetIp: nasIp }) });
const reply = ethernet({ src: nasMac, dst: clientMac, type: 0x0806, pad: true,
  payload: arp({ operation: 2, senderMac: nasMac, senderIp: nasIp, targetMac: clientMac, targetIp: clientIp }) });

function tcpFrame(srcMac, dstMac, { src, dst, id, ttl, srcPort, dstPort, seq, ack = 0 }) {
  // Reference SYN options: MSS 1460, window scale, and SACK permitted, in wire order.
  const options = Uint8Array.of(2, 4, 0x05, 0xb4, 1, ...(ack ? [1, 4, 2, 1, 3, 3, 7] : [3, 3, 8, 1, 1, 4, 2]));
  return ethernet({ src: srcMac, dst: dstMac, payload: ipv4({ src, dst, id, ttl, protocol: 6,
    payload: tcp({ src, dst, srcPort, dstPort, seq, ack, flags: ack ? 0x12 : 0x02, window: 64240, options }) }) });
}

const nasSyn = tcpFrame(clientMac, nasMac, { src: clientIp, dst: nasIp, id: 0xd825, ttl: 128, srcPort: 50532, dstPort: 445, seq: 0xc5880746 });
const nasAck = tcpFrame(nasMac, clientMac, { src: nasIp, dst: clientIp, id: 0x202e, ttl: 64, srcPort: 445, dstPort: 50532, seq: 0xd0acd907, ack: 0xc5880747 });
const webSyn = { src: clientIp, dst: webIp, id: 0xd826, ttl: 128, srcPort: 52344, dstPort: 443, seq: 0xb5cc295f };
const lanSyn = tcpFrame(clientMac, routerMac, webSyn);
const wanSyn = tcpFrame(uplinkMac, ispMac, { ...webSyn, src: publicIp, ttl: 127, srcPort: 40112 });

export const frames = [
  [0, 'client', 'switch', request, 'arp', '从端口 1 进入 · 谁是 192.168.1.20？请告知 192.168.1.10', ['谁是 192.168.1.20？', `发往 ${broadcast}`]],
  [5, 'switch', 'lan', request, 'arp', '从端口 2 发出（泛洪）· 谁是 192.168.1.20？', ['泛洪：端口 2']],
  [5, 'switch', 'router', request, 'arp', '从端口 8 发出（泛洪）· 谁是 192.168.1.20？', ['泛洪：端口 8']],
  [52, 'lan', 'switch', reply, 'arp', `从端口 2 进入 · 192.168.1.20 的 MAC 地址是 ${nasMac}`, ['192.168.1.20 的 MAC 地址是', nasMac]],
  [57, 'switch', 'client', reply, 'arp', `只从端口 1 发出 · 192.168.1.20 的 MAC 地址是 ${nasMac}`, ['只从端口 1']],
  [231, 'client', 'switch', nasSyn, 'nas', '从端口 1 进入 · 50532 → 445 [SYN]', [`发往 ${nasMac}`, '类型 0x0800（IPv4）']],
  [236, 'switch', 'lan', nasSyn, 'nas', '从端口 2 发出 · 50532 → 445 [SYN]', ['只从端口 2']],
  [281, 'lan', 'switch', nasAck, 'nas', '从端口 2 进入 · 445 → 50532 [SYN, ACK]', []],
  [286, 'switch', 'client', nasAck, 'nas', '从端口 1 发出 · 445 → 50532 [SYN, ACK]', []],
  [4128, 'client', 'switch', lanSyn, 'internet', '从端口 1 进入 · 52344 → 443 [SYN]（发给路由器的帧）', [`发往 ${routerMac}`, '发往 203.0.113.10 的 IP 数据包']],
  [4133, 'switch', 'router', lanSyn, 'internet', '从端口 8 发出 · 52344 → 443 [SYN]', ['从端口 8']],
  [4190, 'router', 'isp', wanSyn, 'internet', 'TTL 127 · 40112 → 443 [SYN]（NAT 后的新帧）', ['来自路由器的互联网端口', 'IP 仍发往 203.0.113.10']],
].map(([micros, from, to, bytes, category, summary, badge], i) => ({
  id: `ethernet-${i + 1}`, path: [from, to], bytes, category, summary, badge,
  badgeLabel: ['ARP 请求', 'ARP 应答', 'SYN', 'SYN-ACK', '新的帧'][i < 3 ? 0 : i < 5 ? 1 : i < 7 ? 2 : i < 9 ? 3 : i < 11 ? 2 : 4],
  time: `${(micros / 1e6).toFixed(6)}s`, protocol: category === 'arp' ? 'ARP' : 'TCP',
  leadMs: i === 0 ? 2400 : 350, holdMs: i === 11 ? 1600 : 840,
}));

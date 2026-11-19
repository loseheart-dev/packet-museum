import { arp, ethernet, ipv4, tcp } from '../../lib/bytes/index.js';

const clientMac = '00:00:5e:00:53:10', nasMac = '00:00:5e:00:53:20';
const routerMac = '00:00:5e:00:53:01', uplinkMac = '00:00:5e:00:53:02', ispMac = '00:00:5e:00:53:fe';
const clientIp = '192.168.1.10', nasIp = '192.168.1.20', publicIp = '198.51.100.7', webIp = '203.0.113.10';
const broadcast = 'ff:ff:ff:ff:ff:ff';

// shortcut: omit Ethernet padding until the shared inspector can separate it from ARP.
const request = ethernet({ src: clientMac, dst: broadcast, type: 0x0806,
  payload: arp({ operation: 1, senderMac: clientMac, senderIp: clientIp, targetIp: nasIp }) });
const reply = ethernet({ src: nasMac, dst: clientMac, type: 0x0806,
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
  [0, 'client', 'switch', request, 'arp', 'In port 1 · Who has 192.168.1.20? Tell 192.168.1.10', ['who has 192.168.1.20?', 'to ff:ff:ff:ff:ff:ff']],
  [5, 'switch', 'lan', request, 'arp', 'Out port 2 (flooded) · Who has 192.168.1.20?', ['flooded: port 2']],
  [5, 'switch', 'router', request, 'arp', 'Out port 8 (flooded) · Who has 192.168.1.20?', ['flooded: port 8']],
  [52, 'lan', 'switch', reply, 'arp', `In port 2 · 192.168.1.20 is at ${nasMac}`, ['192.168.1.20 is at', nasMac]],
  [57, 'switch', 'client', reply, 'arp', `Out port 1 only · 192.168.1.20 is at ${nasMac}`, ['port 1 only']],
  [231, 'client', 'switch', nasSyn, 'nas', 'In port 1 · 50532 → 445 [SYN]', [`to ${nasMac}`, 'type 0x0800 (IPv4)']],
  [236, 'switch', 'lan', nasSyn, 'nas', 'Out port 2 · 50532 → 445 [SYN]', ['out of port 2 only']],
  [281, 'lan', 'switch', nasAck, 'nas', 'In port 2 · 445 → 50532 [SYN, ACK]', ['SYN-ACK']],
  [286, 'switch', 'client', nasAck, 'nas', 'Out port 1 · 445 → 50532 [SYN, ACK]', ['SYN-ACK']],
  [4128, 'client', 'switch', lanSyn, 'internet', 'In port 1 · 52344 → 443 [SYN] (frame to the router)', [`to ${routerMac}`, 'IP packet to 203.0.113.10']],
  [4133, 'switch', 'router', lanSyn, 'internet', 'Out port 8 · 52344 → 443 [SYN]', ['out of port 8']],
  [4190, 'router', 'isp', wanSyn, 'internet', 'TTL 127 · 40112 → 443 [SYN] (new frame, after NAT)', ['from the router’s internet port', 'IP still to 203.0.113.10']],
].map(([micros, from, to, bytes, category, summary, badge], i) => ({
  id: `ethernet-${i + 1}`, path: [from, to], bytes, category, summary, badge,
  time: `${(micros / 1e6).toFixed(6)}s`, protocol: category === 'arp' ? 'ARP' : 'TCP',
  leadMs: i === 0 ? 2400 : 350, holdMs: i === 11 ? 1600 : 840,
}));

import { concat, dhcp, ethernet, ipv4, ipv4Address, macAddress, text, udp, uint } from '../../lib/bytes/index.js';
import { messageLabels, packets } from './copy.js';

const client = '192.168.1.10', router = '192.168.1.1';
const clientMac = '00:00:5e:00:53:10', routerMac = '00:00:5e:00:53:01';
const zero = '0.0.0.0', broadcast = '255.255.255.255';
const hostname = text('alice-laptop');
const clientId = [61, concat(uint(1, 1), macAddress(clientMac))];
const fqdn = [81, concat(new Uint8Array(3), hostname)];
const clientOptions = [[60, text('MSFT 5.0')], [55, Uint8Array.of(1, 3, 6, 15, 31, 33, 43, 44, 46, 47, 119, 121, 249, 252)]];
const leaseOptions = [[54, router], [51, 86400], [58, uint(43200, 4)], [59, uint(75600, 4)],
  [1, '255.255.255.0'], [28, ipv4Address('192.168.1.255')], [3, router], [6, '8.8.8.8']];

const messages = [
  [1, 0xd0ce, [[53, 1], clientId, [12, hostname], ...clientOptions]],
  [2, 0xb257, [[53, 2], ...leaseOptions]],
  [1, 0xd0cf, [[53, 3], clientId, [50, client], [54, router], [12, hostname], fqdn, ...clientOptions]],
  [2, 0xb258, [[53, 5], ...leaseOptions]],
  [1, 0xd825, [[53, 3], clientId, [12, hostname], fqdn, ...clientOptions]],
  [2, 0xb259, [[53, 5], ...leaseOptions]],
];

export const frames = messages.map(([op, id, options], i) => {
  const reply = op === 2, renew = i >= 4, xid = renew ? 0x7a1c22e5 : 0x3903f326;
  const [time, category, badge] = packets[i];
  const src = reply ? router : renew ? client : zero;
  const dst = reply ? client : renew ? router : broadcast;
  const messageBytes = dhcp({ op, xid, flags: 0, mac: clientMac, ciaddr: renew ? client : zero, yiaddr: reply ? client : zero, options });
  const payload = concat(messageBytes, new Uint8Array(Math.max(0, 300 - messageBytes.length)));
  const transport = udp({ src, dst, srcPort: reply ? 67 : 68, dstPort: reply ? 68 : 67, payload });
  const bytes = ethernet({ src: reply ? routerMac : clientMac, dst: reply ? clientMac : renew ? routerMac : 'ff:ff:ff:ff:ff:ff',
    payload: ipv4({ src, dst, protocol: 17, payload: transport, id, flags: 0, ttl: reply ? 64 : 128 }) });
  return {
    id: `dhcp-${i + 1}`, path: reply ? ['router', 'client'] : ['client', 'router'], bytes,
    protocol: 'DHCP', application: 'dhcp', time, badge,
    summary: `DHCP ${messageLabels[category]}：事务 ID 0x${xid.toString(16)}`,
    category, leadMs: i === 0 ? 2450 : 1200, holdMs: 1500,
  };
});

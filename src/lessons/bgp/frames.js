import { concat, ethernet, ipv4, ipv4Address, tcp, uint } from '../../lib/bytes/index.js';

const octets = (...bytes) => Uint8Array.of(...bytes);
const marker = new Uint8Array(16).fill(0xff);
const prefix = '203.0.113.0/24';
const nlri = octets(24, 203, 0, 113);
const bgp = (type, body = octets()) => concat(marker, uint(19 + body.length, 2), octets(type), body);
const open = (asn, id) => bgp(1, concat(octets(4), uint(asn, 2), uint(180, 2), ipv4Address(id),
  octets(16, 2, 14, 1, 4, 0, 1, 0, 1, 2, 0, 65, 4), uint(asn, 4)));
const keepalive = bgp(4);
const update = (asPath, nextHop) => {
  const attributes = concat(octets(64, 1, 1, 0, 64, 2, 2 + 4 * asPath.length, 2, asPath.length),
    ...asPath.map(asn => uint(asn, 4)), octets(64, 3, 4), ipv4Address(nextHop));
  return bgp(2, concat(uint(0, 2), uint(attributes.length, 2), attributes, nlri));
};
const withdraw = bgp(2, concat(uint(nlri.length, 2), nlri, uint(0, 2)));

const isp = { ip: '192.0.2.5', port: 50311, isn: 722142808, ts: 130247521, id: 3899, mac: [0x40, 0x80] };
const transit = { ip: '192.0.2.4', port: 179, isn: 1941776240, ts: 3541903693, id: 3496, mac: [0x41, 0x81] };
const hosting = { ip: '192.0.2.9', port: 179, isn: 476171608, ts: 3218964730, id: 2287, mac: [0x42, 0x82] };
const hostingPeer = { ip: '192.0.2.8', port: 41622, isn: 3200554915, ts: 2996739085 };
const client = { ip: '192.168.1.10', port: 52800, isn: 1853384707, id: 55333, mac: [0x10, 0x01] };
const server = { ip: '203.0.113.10', port: 443, isn: 3074084017, id: 3587, mac: [0x01, 0x10] };
export const route = ['client', 'router', 'isp', 'transit', 'hosting', 'app'];
const mac = n => `00:00:5e:00:53:${n.toString(16).padStart(2, '0')}`;
const flags = { SYN: 0x02, 'SYN-ACK': 0x12, ACK: 0x10 };
const timestamp = (value, echo) => concat(octets(8, 10), uint(value, 4), uint(echo, 4));

function frame(id, from, to, path, ms, category, label, summary, { seq, ack, ipId = from.id, echo, payload, badge = [], leadMs, holdMs }) {
  const web = category === 'web', syn = label.startsWith('SYN'), reply = label === 'SYN-ACK';
  const options = web ? reply ? octets(2, 4, 5, 180, 1, 1, 4, 2, 1, 3, 3, 7) : octets(2, 4, 5, 180, 1, 3, 3, 8, 1, 1, 4, 2)
    : syn ? concat(octets(2, 4, 5, 180, 4, 2), timestamp(from.ts + ms, reply ? to.ts + echo : 0), octets(1, 3, 3, 7))
      : concat(octets(1, 1), timestamp(from.ts + ms, to.ts + echo));
  const src = from.ip, dst = to.ip;
  const segment = tcp({ src, dst, srcPort: from.port, dstPort: to.port, seq: from.isn + seq,
    ack: ack ? to.isn + ack : 0, flags: flags[label] ?? 0x18, window: syn ? reply && !web ? 65160 : 64240 : 501, options, payload });
  const bytes = ethernet({ src: mac(from.mac[0]), dst: mac(from.mac[1]),
    payload: ipv4({ src, dst, protocol: 6, ttl: web ? reply ? 52 : 128 : 1, id: ipId, payload: segment }) });
  // shortcut: the shared inspector shows raw BGP payloads until it supports BGP field decoding.
  return { id, path, bytes, protocol: payload ? 'BGP' : 'TCP', time: `${(ms / 1000).toFixed(3)}s`, category,
    summary, badgeLabel: label, badge, leadMs, holdMs, relativeTo: [from.isn, ack ? to.isn : null] };
}

const peer = ['isp', 'transit'], reversePeer = ['transit', 'isp'], origin = ['hosting', 'transit'];
const advertise = `UPDATE Message: ${prefix}`, retract = `UPDATE Message：撤销 ${prefix}`;

export const frames = [
  frame('syn', isp, transit, peer, 0, 'tcp', 'SYN', '50311 → 179 [SYN] Seq=0', { seq: 0, leadMs: 1150, holdMs: 350 }),
  frame('syn-ack', transit, isp, reversePeer, 4, 'tcp', 'SYN-ACK', '179 → 50311 [SYN, ACK] Seq=0 Ack=1', { seq: 0, ack: 1, echo: 0, leadMs: 240, holdMs: 350 }),
  frame('ack', isp, transit, peer, 8, 'tcp', 'ACK', '50311 → 179 [ACK] Seq=1 Ack=1', { seq: 1, ack: 1, echo: 4, ipId: 3900, leadMs: 240, holdMs: 350 }),
  frame('isp-open', isp, transit, peer, 8, 'session', 'OPEN', 'OPEN Message', { seq: 1, ack: 1, echo: 4, ipId: 3901, payload: open(64500, isp.ip), badge: ['AS 64500', '保持 180 s'], leadMs: 650, holdMs: 1150 }),
  frame('transit-open', transit, isp, reversePeer, 12, 'session', 'OPEN', 'OPEN Message', { seq: 1, ack: 46, echo: 8, ipId: 3497, payload: open(64510, transit.ip), badge: ['AS 64510', '保持 180 s'], leadMs: 450, holdMs: 1150 }),
  frame('transit-keepalive', transit, isp, reversePeer, 12, 'session', '保活', 'KEEPALIVE Message', { seq: 46, ack: 46, echo: 8, ipId: 3498, payload: keepalive, leadMs: 240, holdMs: 350 }),
  frame('isp-keepalive', isp, transit, peer, 16, 'session', '保活', 'KEEPALIVE Message', { seq: 46, ack: 65, echo: 12, ipId: 3902, payload: keepalive, leadMs: 240, holdMs: 1050 }),
  frame('announce', hosting, hostingPeer, origin, 30, 'routes', 'UPDATE', advertise, { seq: 1240, ack: 1186, echo: 0, payload: update([64511], hosting.ip), badge: [prefix, '路径 64511'], leadMs: 1150, holdMs: 1550 }),
  frame('forward', transit, isp, reversePeer, 37, 'routes', 'UPDATE', advertise, { seq: 65, ack: 65, echo: 16, ipId: 3499, payload: update([64510, 64511], transit.ip), badge: [prefix, '路径 64510 64511'], leadMs: 1150, holdMs: 1650 }),
  frame('web-syn', client, server, route, 1000, 'web', 'SYN', '52800 → 443 [SYN] Seq=0', { seq: 0, badge: ['to 203.0.113.10'], leadMs: 1150, holdMs: 900 }),
  frame('web-syn-ack', server, client, [...route].reverse(), 1017, 'web', 'SYN-ACK', '443 → 52800 [SYN, ACK] Seq=0 Ack=1', { seq: 0, ack: 1, badge: ['回程'], leadMs: 450, holdMs: 1050 }),
  frame('withdraw', hosting, hostingPeer, origin, 5000, 'routes', '撤销', retract, { seq: 1287, ack: 1186, echo: 0, ipId: 2288, payload: withdraw, badge: [prefix], leadMs: 1150, holdMs: 1100 }),
  frame('forward-withdrawal', transit, isp, reversePeer, 5007, 'routes', '撤销', retract, { seq: 116, ack: 65, echo: 16, ipId: 3500, payload: withdraw, badge: [prefix], leadMs: 450, holdMs: 1100 }),
];

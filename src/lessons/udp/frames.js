import { concat, ethernet, ipv4, udp, uint } from '../../lib/bytes/index.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', web: '203.0.113.20' };
const clientMac = '00:00:5e:00:53:10', routerMac = '00:00:5e:00:53:01';
const outbound = ['client', 'router', 'internet', 'web'];
const inbound = [...outbound].reverse();
const times = ['0.000s', '0.020s', '0.040s', '0.060s', '0.080s', '0.100s', '0.120s', '0.140s', '0.150s', '0.170s', '0.190s'];
const lossNote = '第 7 帧丢失 · 不重发';

export const frames = times.map((time, i) => {
  const reply = i >= 8, lost = i === 6, n = reply ? i - 8 : i;
  const src = reply ? addresses.web : addresses.client, dst = reply ? addresses.client : addresses.web;
  const srcPort = reply ? 5004 : 50000, dstPort = reply ? 50000 : 5004;
  // The reference hides the 80 Opus bytes, so use zero placeholders to compute a valid UDP checksum.
  const rtp = concat(uint(0x80, 1), uint(n ? 111 : 0xef, 1), uint((reply ? 4419 : 21738) + n, 2),
    uint((reply ? 913280 : 2617440) + 960 * n, 4), uint(reply ? 460833806 : 1590076113, 4), new Uint8Array(80));
  const payload = udp({ src, dst, srcPort, dstPort, payload: rtp });
  const ip = ipv4({ src, dst, protocol: 17, payload, id: (reply ? 0x9ec8 : 0xd825) + n,
    ttl: reply ? 52 : 128, flags: reply ? 0x4000 : 0 });
  return {
    id: `udp-${i + 1}`, path: reply ? inbound : lost ? outbound.slice(0, -1) : outbound,
    bytes: ethernet({ src: reply ? routerMac : clientMac, dst: reply ? clientMac : routerMac, payload: ip }),
    time, protocol: 'UDP', summary: `${srcPort} → ${dstPort} 长度=92`,
    category: lost ? 'lost' : reply ? 'reply' : 'voice',
    badge: i === 0 ? ['UDP 50000 → 5004', '92 B 音频，无需建立'] : lost ? ['语音 7', lossNote] : [`${reply ? '对方语音' : '语音'} ${n + 1}`],
    ...(lost ? { outcome: 'dropped' } : {}),
    leadMs: i === 0 ? 2350 : i === 5 || i === 8 ? 740 : 180,
    holdMs: i === 0 || lost || i === 10 ? 1050 : 220,
  };
});

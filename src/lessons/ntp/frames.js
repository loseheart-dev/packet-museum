import { concat, ethernet, ipv4, ipv4Address, udp, uint } from '../../lib/bytes/index.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', web: '203.0.113.123' };
export const ntpEpoch = 2208988800;
const base = Date.UTC(2026, 10, 7, 9, 41, 0) / 1000;
export const t1 = base - .25, t2 = base + .012, t3 = base + .0121, t4 = base + .0241 - .25;
const ms = seconds => `${(seconds * 1000).toFixed(1)} ms`;
export const offset = ms(((t2 - t1) + (t3 - t4)) / 2);
export const delay = ms((t4 - t1) - (t3 - t2));

const timestamp = seconds => concat(uint(seconds ? Math.floor(seconds) + ntpEpoch : 0, 4),
  uint(Math.round((seconds % 1) * 2 ** 32), 4));
const fixed = seconds => uint(Math.round(seconds * 65536), 4);
const clientMac = '00:00:5e:00:53:10', routerMac = '00:00:5e:00:53:01';

export function frameBytes(server) {
  const src = addresses[server ? 'web' : 'client'], dst = addresses[server ? 'client' : 'web'];
  const payload = concat(
    Uint8Array.of(3 << 3 | (server ? 4 : 3), server ? 2 : 0, 6, 233),
    fixed(server ? .0089 : 0), fixed(server ? .0213 : 0), ipv4Address(server ? '192.0.2.123' : '0.0.0.0'),
    timestamp(server ? base - 523.418 : 0), timestamp(server ? t1 : 0), timestamp(server ? t2 : 0), timestamp(server ? t3 : t1),
  );
  return ethernet({ src: server ? routerMac : clientMac, dst: server ? clientMac : routerMac,
    payload: ipv4({ src, dst, protocol: 17, id: server ? 0xebee : 0xd825, ttl: server ? 52 : 128, flags: server ? 0x4000 : 0,
      payload: udp({ src, dst, srcPort: 123, dstPort: 123, payload }),
    }),
  });
}

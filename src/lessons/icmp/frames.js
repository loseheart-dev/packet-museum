import { concat, ethernet, ipv4, text, udp, uint } from '../../lib/bytes/index.js';
import { checksum, decode, numberHex, Reader, requireBytes, size } from '../../lib/bytes/core.js';

export const addresses = { client: '192.168.1.10', router: '192.168.1.1', web: '203.0.113.10', isp: '198.51.100.1' };
const { client, router, web, isp } = addresses;
const clientMac = '00:00:5e:00:53:10', routerMac = '00:00:5e:00:53:01';
const toWeb = ['client', 'router', 'internet', 'web'];
const fromWeb = [...toWeb].reverse();
const filler = text('abcdefghijklmnopqrstuvwabcdefghi');

function icmp(type, code, rest, data) {
  const bytes = concat(uint(type, 1), uint(code, 1), uint(0, 2), rest, data);
  bytes.set(uint(checksum(bytes), 2), 2);
  return bytes;
}

const echo = (type, seq) => icmp(type, 0, concat(uint(1, 2), uint(seq, 2)), filler);
const error = (type, code, quote) => icmp(type, code, uint(0, 4), quote);
const ip = (src, dst, id, ttl, payload, protocol = 1) => ipv4({ src, dst, id, ttl, payload, protocol, flags: 0 });

const hop1 = ip(client, web, 0xd826, 1, echo(8, 2));
const hop2 = ip(client, web, 0xd827, 2, echo(8, 3));
const hop2Quote = ip(client, web, 0xd827, 1, echo(8, 3)).subarray(0, 28);
const datagram = ip(client, web, 0xd829, 128, udp({ src: client, dst: web, srcPort: 52500, dstPort: 9999, payload: text('hello, anyone here') }), 17);

const request = (seq, ttl) => `Echo (ping) request id=0x0001, seq=${seq}, ttl=${ttl}`;
const reply = seq => `Echo (ping) reply id=0x0001, seq=${seq}, ttl=52`;
const expired = 'Time-to-live exceeded (in transit)';

export const frames = [
  ['ping-request', '0.000s', toWeb, 'probe', request(1, 128), '回显请求', ['类型 8 · seq 1', '32 字节数据'], ip(client, web, 0xd825, 128, echo(8, 1))],
  ['ping-reply', '0.017s', fromWeb, 'reply', reply(1), '回显应答', ['类型 0 · seq 1', '同样的 32 字节传回来'], ip(web, client, 0x0e03, 52, echo(0, 1))],
  ['hop-1-probe', '1.000s', ['client', 'router'], 'probe', request(2, 1), 'TTL 1', ['回显请求', '在第一个路由器处到期'], hop1],
  ['hop-1-expired', '1.001s', ['router', 'client'], 'error', expired, '超时', ['类型 11 · 来自 192.168.1.1', '引用被丢弃的头部'], ip(router, client, 0xb257, 64, error(11, 0, hop1))],
  ['hop-2-probe', '2.000s', ['client', 'router', 'internet'], 'probe', request(3, 2), 'TTL 2', ['回显请求', '在第二个路由器处到期'], hop2],
  ['hop-2-expired', '2.005s', ['internet', 'router', 'client'], 'error', expired, '超时', ['类型 11 · 来自 198.51.100.1', '引用被丢弃的头部'], ip(isp, client, 0x5262, 254, error(11, 0, hop2Quote))],
  ['hop-13-probe', '3.000s', toWeb, 'probe', request(4, 13), 'TTL 13', ['回显请求', '足以到达的跳数'], ip(client, web, 0xd828, 13, echo(8, 4))],
  ['hop-13-reply', '3.017s', fromWeb, 'reply', reply(4), '回显应答', ['服务器本身回答', '路由终点'], ip(web, client, 0x0e04, 52, echo(0, 4))],
  ['udp-probe', '4.000s', toWeb, 'probe', '52500 → 9999 Len=18', 'UDP', ['发往 9999 端口', '那里没有程序在监听'], datagram],
  ['port-unreachable', '4.017s', fromWeb, 'error', 'Destination unreachable (Port unreachable)', '不可达', ['类型 3 · 代码 3', '端口不可达'], ip(web, client, 0x0e05, 52, error(3, 3, ip(client, web, 0xd829, 116, datagram.subarray(20), 17)))],
].map(([id, time, path, category, summary, badgeLabel, badge, payload], i) => {
  // The frames are viewed on the client’s LAN, including the remote replies.
  const outgoing = path[0] === 'client';
  return {
    id, time, path, category, summary, badgeLabel, badge, leadMs: i === 0 ? 2350 : 900,
    protocol: id === 'udp-probe' ? 'UDP' : 'ICMP',
    bytes: ethernet({ src: outgoing ? clientMac : routerMac, dst: outgoing ? routerMac : clientMac, payload }),
  };
});

const types = { 0: '回显应答', 3: '目的不可达（端口不可达）', 8: '回显请求', 11: '超时（TTL 降到 0）' };

// shortcut: decode the ICMPv4 types used here; extend when the shared inspector supports ICMP.
export function parseICMP(bytes, offset) {
  const r = new Reader(bytes, offset, 'ICMP', 'ip');
  const type = r.number('类型', 1, n => `${n} (${types[n]})`);
  const code = r.number('代码', 1);
  r.number('校验和', 2, numberHex);
  requireBytes(Object.hasOwn(types, type) && code === (type === 3 ? 3 : 0), '不支持的 ICMP 类型或代码');
  requireBytes(checksum(bytes) === 0, 'ICMP 校验和错误');
  if (type === 0 || type === 8) {
    r.number('标识符', 2, numberHex);
    r.number('序列号', 2);
    r.slice('数据', r.rest(), decode);
  } else {
    r.number('未使用', 4);
    const quote = r.slice('原始数据包', r.rest(), size);
    const headerLength = (quote[0] & 15) * 4;
    requireBytes(quote[0] >> 4 === 4 && headerLength >= 20 && quote.length >= headerLength + 8 &&
      checksum(quote.subarray(0, headerLength)) === 0, 'ICMP 引用的 IPv4 头部无效');
  }
  return r.layer();
}

import { concat, ethernet, ipv4, ipv4Address, udp, uint } from '../../lib/bytes/index.js';
import { checksum, ipText, macText, numberHex, Reader, requireBytes } from '../../lib/bytes/core.js';

const group = '233.252.0.1', allHosts = '224.0.0.1', allRouters = '224.0.0.2';
const lanMac = '00:00:5e:00:53:01', providerMac = '00:00:5e:00:53:fe';
const hosts = {
  stb: ['192.168.1.30', '00:00:5e:00:53:30'],
  client: ['192.168.1.10', '00:00:5e:00:53:10'],
  router: ['192.168.1.1', lanMac],
  wan: ['198.51.100.7', '00:00:5e:00:53:02'],
};

function multicastFrame(src, dst, mac, ip) {
  const [, second, third, fourth] = ipv4Address(dst);
  return ethernet({ src: mac, dst: macText([1, 0, 0x5e, second & 0x7f, third, fourth]), pad: true,
    payload: ipv4({ src, dst, ...ip }),
  });
}

function membership(type, member, response) {
  const bytes = concat(uint(type, 1), uint(response, 1), uint(0, 2), ipv4Address(member));
  bytes.set(uint(checksum(bytes), 2), 2);
  return bytes;
}

const messageTypes = { 0x11: 'Membership Query', 0x16: 'Membership Report', 0x17: 'Leave Group' };
export function parseMembership(bytes, offset) {
  // shortcut: only the three IGMPv2 messages used in this lesson; dispatch by version if IGMPv3 is added.
  const reader = new Reader(bytes, offset, 'IGMPv2', 'ip');
  const type = reader.number('类型', 1, n => `${numberHex(n, 2)} (${messageTypes[n]})`);
  requireBytes(Object.hasOwn(messageTypes, type), '未知 IGMPv2 消息类型');
  reader.number('最长应答时间', 1, n => type === 0x11 ? `${n / 10} s` : String(n));
  reader.number('校验和', 2, numberHex);
  reader.slice('组地址', 4, ipText);
  reader.end();
  requireBytes(checksum(bytes) === 0, 'IGMPv2 校验和错误');
  return reader.layer();
}

const makeFrame = (id, path, time, category, protocol, summary, badge, bytes) => ({
  id: `igmp-${id}`, path, time, category, protocol, summary, badge, bytes,
});
function control(id, path, time, host, ipId, type, badge, response = 0, badgeLabel) {
  const [src, mac] = hosts[host];
  const query = type === 0x11, general = response === 100;
  const member = general ? '0.0.0.0' : group;
  const dst = general ? allHosts : type === 0x17 ? allRouters : group;
  const summary = query ? general ? 'Membership Query, general' : `Membership Query, specific for group ${group}`
    : type === 0x16 ? `Membership Report group ${group}` : `Leave Group ${group}`;
  const frame = makeFrame(id, path, time, query ? 'query' : 'membership', 'IGMPv2', summary, [badge],
    multicastFrame(src, dst, mac, { protocol: 2, id: ipId, ttl: 1,
      flags: host === 'client' ? 0 : 0x4000, dscp: host === 'client' ? 0 : 192,
      options: uint(0x94040000, 4), payload: membership(type, member, response),
    }));
  return { ...frame, badgeLabel: badgeLabel ?? (query ? '查询' : type === 0x17 ? '离开' : '报告') };
}

function channel(id, path, time, ipId, counter, ttl, badge) {
  const src = '203.0.113.80';
  // shortcut: the reference hides TS media bytes and six headers; keep synthetic payload until real captures are available.
  const payload = new Uint8Array(7 * 188);
  for (let i = 0; i < 7; i++) payload.set([0x47, 0x01, 0, 0x10 | ((counter + i) & 15)], i * 188);
  return makeFrame(id, path, time, 'channel', 'MPEG TS', '5000 → 1234 Len=1316, 7 TS packets (video PID 256)', badge,
    multicastFrame(src, group, ttl === 62 ? providerMac : lanMac, { protocol: 17, id: ipId, ttl, flags: 0,
      payload: udp({ src, dst: group, srcPort: 5000, dstPort: 1234, payload }),
    }));
}

const relay = '只发往路由器端口';
const join = '请给 233.252.0.1';
const watching = '还在看';
const forwarded = '放进家里';
const report = (id, path, time, ipId, badge, label) => control(id, path, time, path[0], ipId, 0x16, badge, 0, label);
const copy = (frame, id, to, time, badge) => ({ ...frame, id: `igmp-${id}`, path: ['switch', to], time, badge: [badge] });

const tvJoin = report(1, ['stb', 'switch'], '0.000000s', 0x6837, join, '加入');
const firstChannel = channel(5, ['router', 'switch'], '0.014306s', 0x8df2, 4, 61, [forwarded]);
const clientJoin = report(7, ['client', 'switch'], '4.200000s', 0xd825, join, '加入');
const secondChannel = channel(10, ['router', 'switch'], '4.204106s', 0x8df3, 9, 61, [forwarded]);
const generalQuery = control(13, ['router', 'switch'], '125.600000s', 'router', 0xb257, 0x11, '还要哪些组？', 100);
const tvReport = report(16, ['stb', 'switch'], '128.930000s', 0x6838, watching);
const clientReport = report(18, ['client', 'switch'], '133.410000s', 0xd826, watching);
const clientLeave = control(20, ['client', 'switch'], '300.500000s', 'client', 0xd827, 0x17, '233.252.0.1 不看了');
const specificQuery = control(22, ['router', 'switch'], '300.500400s', 'router', 0xb258, 0x11, '有人要 233.252.0.1 吗？', 10);
const finalReport = report(25, ['stb', 'switch'], '300.830000s', 0x6839, watching);

export const stepFrames = [
  [tvJoin, copy(tvJoin, 2, 'router', '0.000006s', relay)],
  [control(3, ['router', 'isp'], '0.000400s', 'wan', 0x48f0, 0x16, '代表全家', 0, '加入')],
  [channel(4, ['isp', 'router'], '0.012300s', 0x8df2, 4, 62, [`to ${group}`, '基于 UDP 的 MPEG-TS']),
    firstChannel, copy(firstChannel, 6, 'stb', '0.014318s', '只发端口 2')],
  [clientJoin, copy(clientJoin, 8, 'router', '4.200006s', relay),
    channel(9, ['isp', 'router'], '4.202100s', 0x8df3, 9, 62, ['同一路流']), secondChannel,
    copy(secondChannel, 11, 'client', '4.204118s', 'copy for port 1'), copy(secondChannel, 12, 'stb', '4.204118s', 'copy for port 2')],
  [generalQuery, copy(generalQuery, 14, 'client', '125.600006s', 'to port 1'), copy(generalQuery, 15, 'stb', '125.600006s', 'to port 2'),
    tvReport, copy(tvReport, 17, 'router', '128.930006s', relay), clientReport, copy(clientReport, 19, 'router', '133.410006s', relay)],
  [clientLeave, copy(clientLeave, 21, 'router', '300.500006s', relay), specificQuery,
    copy(specificQuery, 23, 'client', '300.500406s', 'to port 1'), copy(specificQuery, 24, 'stb', '300.500406s', 'to port 2'),
    finalReport, copy(finalReport, 26, 'router', '300.830006s', relay)],
];

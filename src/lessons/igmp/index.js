import { outro, overview, steps } from './copy.js';
import { stepFrames } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', address: '192.168.1.10', kind: 'laptop', x: 128, y: 355 },
  { id: 'switch', label: '交换机', address: '8 个端口', kind: 'switch', x: 248, y: 258, labelAt: { x: -18, y: -53 } },
  { id: 'stb', label: '电视盒', address: '192.168.1.30', kind: 'tv-box', x: 319, y: 129, labelAt: { x: 92, y: -34 } },
  { id: 'router', label: '路由器', address: '192.168.1.1', kind: 'router', x: 448, y: 281 },
  { id: 'isp', label: 'ISP 路由器', address: '电视频道', kind: 'multicast-router', x: 637, y: 369 },
];
const links = [
  { nodes: ['client', 'switch'], points: [[155, 308], [215, 249]] },
  { nodes: ['switch', 'stb'], points: [[257, 228], [276, 128]] },
  { nodes: ['switch', 'router'], points: [[291, 242], [409, 263]] },
  { nodes: ['router', 'isp'], points: [[486, 264], [595, 344]] },
];
const parallel = [[], [], [], [['igmp-11', 'igmp-12']], [['igmp-14', 'igmp-15']], [['igmp-23', 'igmp-24']]];

export default {
  meta: { id: 'igmp', title: 'IGMP', subtitle: '组播与电视频道', group: 1, order: 18, layer: 3 },
  overview, outro, nodes, links,
  frames: stepFrames.flatMap((frames, step) => frames.map((frame, i) => ({
    ...frame, leadMs: i === 0 && step < 2 ? 2350 : i === 0 ? 1250 : 650,
  }))),
  sequenceNodes: nodes.map(node => node.id), timeColumn: true, linkAddresses: true,
  legend: {
    membership: { label: '加入与离开', tone: 'referral' },
    query: { label: '查询次数', title: '查询', tone: 'violet' },
    channel: { label: '频道 1', tone: 'blue' },
  },
  steps: steps.map((step, i) => ({
    ...step, frames: stepFrames[i].map(frame => frame.id), parallel: parallel[i],
    ...(i === 0 ? { nodes: ['client', 'switch', 'stb', 'router'], closeup: ['stb'] } : { wide: true }),
    ...(i === 1 ? { closeup: ['router', 'isp'] } : {}),
  })),
};

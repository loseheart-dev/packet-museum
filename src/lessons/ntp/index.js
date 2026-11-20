import { addresses, frameBytes } from './frames.js';
import { overview, outro, steps } from './copy.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 130, y: 320 },
  { id: 'router', label: '路由器', kind: 'router', x: 300, y: 246 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 508, y: 321 },
  { id: 'web', label: 'time.windows.com', kind: 'ntp-server', x: 644, y: 161, labelAt: { x: -49, y: -49, anchor: 'end' } },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'router'], points: [[185, 294], [262, 246]] },
  { nodes: ['router', 'internet'], points: [[339, 246], [453, 306]] },
  { nodes: ['internet', 'web'], points: [[557, 280], [622, 172]] },
];

const path = nodes.map(({ id }) => id);
const frames = [
  {
    id: 'ntp-1', path, bytes: frameBytes(false), protocol: 'NTP', time: '0.000s',
    category: 'request', summary: 'NTP Version 3, client', badge: ['T1 09:40:59.750'], leadMs: 900, holdMs: 1400,
  },
  {
    id: 'ntp-2', path: path.toReversed(), bytes: frameBytes(true), protocol: 'NTP', time: '0.012s',
    category: 'answer', summary: 'NTP Version 3, server', badge: ['T2 09:41:00.012000', 'T3 09:41:00.012100'], leadMs: 900, holdMs: 2100,
  },
];

export default {
  meta: { id: 'ntp', title: 'NTP', subtitle: '网络时间协议', group: 2, order: 19, layer: 7 },
  overview, outro, nodes, links, steps, frames,
  sequenceNodes: ['client', 'web'],
  legend: {
    request: { label: '请求', tone: 'referral' },
    answer: { label: '回答', tone: 'violet' },
  },
};

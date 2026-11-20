import { overview, outro, steps } from './copy.js';
import { addresses, frames } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 130, y: 320 },
  { id: 'router', label: '路由器', kind: 'router', x: 300, y: 246 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 508, y: 321 },
  { id: 'web', label: 'Web 服务器', kind: 'web-server', x: 644, y: 161 },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'router'], points: [[185, 294], [262, 246]] },
  { nodes: ['router', 'internet'], points: [[339, 246], [453, 306]] },
  { nodes: ['internet', 'web'], points: [[557, 280], [622, 172]] },
];

export default {
  meta: { id: 'icmp', title: 'ICMP', subtitle: '互联网控制消息', group: 1, order: 17, layer: 3 },
  overview, outro, nodes, links, frames,
  sequenceNodes: ['client', 'router', 'internet', 'web'],
  legend: {
    probe: { label: 'Ping / 探测', tone: 'referral' },
    reply: { label: '回显应答', tone: 'reply' },
    error: { label: '错误报告', tone: 'navy' },
  },
  steps: steps.map(step => ({ ...step, wide: true })),
};

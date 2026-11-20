import { overview, outro, steps } from './copy.js';
import { addresses, frames } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 130, y: 320 },
  { id: 'router', label: '路由器', kind: 'router', x: 300, y: 246 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 508, y: 321 },
  { id: 'web', label: 'www.example.com', kind: 'web-server', x: 644, y: 161, labelAt: { x: -49, y: -49, anchor: 'end' } },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'router'], points: [[185, 294], [262, 246]] },
  { nodes: ['router', 'internet'], points: [[339, 246], [453, 306]] },
  { nodes: ['internet', 'web'], points: [[557, 280], [622, 172]] },
];

const ids = (from, to) => frames.slice(from, to).map(({ id }) => id);

export default {
  meta: { id: 'quic', title: 'QUIC', subtitle: '基于 UDP 的 HTTP/3', group: 1, order: 7, layer: 4 },
  overview, outro, nodes, links, frames,
  sequenceNodes: ['client', 'web'],
  legend: {
    handshake: { label: '握手', tone: 'teal' },
    request: { label: '请求', tone: 'referral' },
    response: { label: '响应', tone: 'violet' },
  },
  steps: [
    { id: 'choosing', ...steps[0], closeup: ['client'], wide: true, holdMs: 3500,
      events: [{ node: 'client', atMs: 250, text: 'www.example.com' }] },
    { id: 'initial', ...steps[1], wide: true, frames: ids(0, 2), parallel: [ids(0, 2)] },
    { id: 'server-hello', ...steps[2], wide: true, frames: ids(2, 6), parallel: [ids(3, 6)] },
    { id: 'finished', ...steps[3], wide: true, frames: ids(6, 8), parallel: [ids(6, 8)] },
    { id: 'response', ...steps[4], wide: true, frames: ids(8, 10) },
    { id: 'new-network', ...steps[5], wide: true,
      events: [{ node: 'client', text: '任何网络上都是同一条连接' }] },
  ],
};

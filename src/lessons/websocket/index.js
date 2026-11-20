import { overview, outro, steps } from './copy.js';
import { addresses, frames } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 130, y: 320 },
  { id: 'router', label: '路由器', kind: 'router', x: 300, y: 246 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 508, y: 321 },
  { id: 'web', label: 'www.example.com', kind: 'web-server', x: 644, y: 161 },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'router'], points: [[185, 294], [262, 246]] },
  { nodes: ['router', 'internet'], points: [[339, 246], [453, 306]] },
  { nodes: ['internet', 'web'], points: [[557, 280], [622, 172]] },
];
const boundaries = [0, 3, 4, 5, 7, 9, 11];

export default {
  meta: { id: 'websocket', title: 'WebSocket', subtitle: '双向 Web 消息', group: 2, order: 2, layer: 7 },
  overview, outro, nodes, links, frames,
  sequenceNodes: ['client', 'web'],
  legend: {
    tcp: { label: 'TCP', tone: 'reply' },
    client: { label: '来自浏览器', tone: 'referral' },
    web: { label: '来自服务器', tone: 'violet' },
  },
  steps: steps.map((step, i) => ({
    ...step, wide: true,
    frames: frames.slice(boundaries[i], boundaries[i + 1]).map(({ id }) => id),
    ...(i === 0 ? { closeup: ['client'] } : {}),
    ...(i === 2 ? { events: [{ node: 'client', after: 'websocket-5', text: '现在是 WEBSOCKET 了' }] } : {}),
  })),
};

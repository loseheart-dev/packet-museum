import { addresses, frames } from './frames.js';
import { outro, overview, preparation, rendering, stages } from './copy.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 130, y: 320 },
  { id: 'router', label: '路由器', kind: 'router', x: 300, y: 246 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 508, y: 321 },
  { id: 'resolver', label: 'DNS 解析器', kind: 'dns-server', x: 490, y: 132, labelAt: { x: -53, y: -43, anchor: 'end' } },
  { id: 'web', label: 'Web 服务器', kind: 'web-server', x: 644, y: 161 },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'router'], points: [[185, 294], [262, 246]] },
  { nodes: ['router', 'internet'], points: [[339, 246], [453, 306]] },
  { nodes: ['internet', 'resolver'], points: [[506, 273], [491, 145]] },
  { nodes: ['internet', 'web'], points: [[557, 280], [622, 172]] },
];

export default {
  meta: { id: 'http', title: 'HTTP', subtitle: '超文本传输', group: 2, order: 1, layer: 7 },
  // shortcut: No-packet stages use the overview and summary until playback accepts steps without frames.
  overview: { ...overview, text: `${overview.text} ${preparation.text}`, facts: [...overview.facts, ...preparation.facts] },
  outro: { ...outro, text: `${rendering.text} ${outro.text}`, facts: [...rendering.facts.slice(0, 2), ...outro.facts] },
  nodes, links, frames,
  sequenceNodes: ['client', 'resolver', 'web'],
  legend: {
    dns: { label: 'DNS', tone: 'query' },
    tcp: { label: 'TCP', tone: 'referral' },
    request: { label: '请求', title: 'GET /', tone: 'query' },
    reply: { label: '响应', title: '200 OK', tone: 'reply' },
  },
  steps: [
    { id: 'dns', ...stages[0], frames: ['http-1', 'http-2'], nodes: ['client', 'router', 'internet', 'resolver'], closeup: ['client', 'router'] },
    { id: 'tcp', ...stages[1], frames: ['http-3', 'http-4', 'http-5'], wide: true },
    { id: 'exchange', ...stages[2], frames: ['http-6', 'http-7'], wide: true },
  ],
};

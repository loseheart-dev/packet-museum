import { addresses, frames, responseIds } from './frames.js';
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
  overview, outro, nodes, links, frames,
  reassembly: [{ frames: responseIds, protocol: 'HTTP', application: 'http', summary: 'HTTP/1.1 200 OK (text/html)，9 个报文段' }],
  sequenceNodes: ['client', 'resolver', 'web'],
  legend: {
    dns: { label: 'DNS', tone: 'blue' },
    tcp: { label: 'TCP', tone: 'reply' },
    request: { label: '请求', title: 'GET /', tone: 'referral' },
    reply: { label: '响应', title: '200 OK', tone: 'violet' },
  },
  steps: [
    { id: 'request', ...preparation, nodes: ['client', 'router'], closeup: ['client'], events: [{ node: 'client', text: 'http://www.example.com/' }] },
    { id: 'dns', ...stages[0], frames: ['http-1', 'http-2'], nodes: ['client', 'router', 'internet', 'resolver'], closeup: ['client', 'router'] },
    { id: 'tcp', ...stages[1], frames: ['http-3', 'http-4', 'http-5'], wide: true },
    { id: 'exchange', ...stages[2], frames: ['http-6', ...responseIds], parallel: [responseIds], wide: true },
    { id: 'render', ...rendering, nodes: ['client'], events: [{ node: 'client', time: '0.094s', text: 'HTML 页面已渲染' }] },
  ],
};

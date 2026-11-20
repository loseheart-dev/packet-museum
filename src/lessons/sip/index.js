import { overview, outro, steps } from './copy.js';
import { addresses, stepFrames } from './frames.js';

const nodes = [
  { id: 'client', label: 'Alice', kind: 'laptop', x: 92, y: 306 },
  { id: 'router', label: '路由器', kind: 'router', x: 238, y: 253 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 422, y: 313 },
  { id: 'relay', label: 'SIP 服务器', kind: 'sip-server', x: 403, y: 146, labelAt: { x: -44, y: -68, anchor: 'end' } },
  { id: 'remote', label: 'Bob 的路由器', kind: 'router', x: 580, y: 248 },
  { id: 'peer', label: 'Bob', kind: 'laptop', x: 706, y: 298 },
].map(node => ({ ...node, address: addresses[node.id] }));
const links = [
  { nodes: ['client', 'router'], points: [[137, 280], [198, 253]] },
  { nodes: ['router', 'internet'], points: [[277, 253], [370, 299]] },
  { nodes: ['internet', 'relay'], points: [[408, 262], [404, 158]] },
  { nodes: ['internet', 'remote'], points: [[479, 293], [540, 257]] },
  { nodes: ['remote', 'peer'], points: [[617, 251], [661, 271]] },
];

export default {
  meta: { id: 'sip', title: 'SIP', subtitle: '网络电话', group: 2, order: 4, layer: 7 },
  overview, outro, nodes, links, frames: stepFrames.flat(), sequenceNodes: ['client', 'relay', 'peer'],
  legend: {
    request: { label: '请求', tone: 'referral' },
    response: { label: '响应', tone: 'violet' },
    voice: { label: '语音 (RTP)', tone: 'reply' },
  },
  steps: steps.map((step, i) => ({
    ...step, frames: stepFrames[i].map(frame => frame.id),
    ...(i === 0 ? { nodes: ['client', 'router', 'internet', 'relay'], closeup: ['client'] } : { wide: true }),
  })),
};

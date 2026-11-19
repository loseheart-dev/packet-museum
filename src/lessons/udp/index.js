import { addresses, frames } from './frames.js';
import { outro, overview, steps } from './copy.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 119, y: 341 },
  { id: 'router', label: '路由器', kind: 'router', x: 313, y: 258 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 556, y: 334 },
  { id: 'web', label: '媒体服务器', kind: 'web-server', x: 640, y: 143 },
].map(node => ({ ...node, address: addresses[node.id] }));
const ranges = [[0, 1], [1, 5], [5, 8], [8, 11]];

export default {
  meta: { id: 'udp', title: 'UDP', subtitle: '用户数据报', group: 1, order: 9, layer: 4 },
  overview, outro, nodes, frames,
  links: [
    { nodes: ['client', 'router'], points: [[174, 307], [275, 258]] },
    { nodes: ['router', 'internet'], points: [[352, 258], [500, 318]] },
    { nodes: ['internet', 'web'], points: [[548, 286], [599, 124]] },
  ],
  sequenceNodes: ['client', 'internet', 'web'],
  legend: {
    voice: { label: '你的声音', tone: 'query' },
    reply: { label: '对方的声音', tone: 'reply' },
    lost: { label: '第 7 帧丢失', tone: 'referral' },
  },
  steps: steps.map((step, i) => ({
    ...step, wide: true,
    ...(i === 0 ? { closeup: ['client'] } : {}),
    frames: frames.slice(...ranges[i]).map(frame => frame.id),
  })),
};

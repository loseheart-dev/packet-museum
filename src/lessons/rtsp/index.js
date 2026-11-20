import { overview, outro, steps } from './copy.js';
import { addresses, frames } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'laptop', x: 222, y: 349, scale: 1.23 },
  { id: 'router', label: '路由器', kind: 'router', x: 540, y: 232, scale: 1.15 },
  { id: 'cam', label: 'IP 摄像头', kind: 'camera', x: 390, y: 105, scale: 1.2 },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'router'], points: [[264, 328], [501, 236]] },
  { nodes: ['router', 'cam'], points: [[521, 218], [419, 111]] },
];

const stepFrames = [[0, 5], [5, 9], [9, 11], [11, 13], [13, 16], [16, 18]].map(([start, end]) => frames.slice(start, end).map(({ id }) => id));

export default {
  meta: { id: 'rtsp', title: 'RTSP', subtitle: 'IP 摄像头视频流', group: 2, order: 5, layer: 7 },
  overview, outro, nodes, links, frames,
  sequenceNodes: ['client', 'cam'], timeColumn: true,
  legend: {
    tcp: { label: 'TCP', tone: 'reply' },
    request: { label: '请求', tone: 'referral' },
    reply: { label: '应答', tone: 'violet' },
    video: { label: '视频 (RTP)', tone: 'blue' },
  },
  steps: steps.map((step, i) => ({
    ...step, frames: stepFrames[i],
    ...(i === 0 ? { closeup: ['client'] } : {}),
    ...(i === 4 ? { wide: true, parallel: [stepFrames[i]] } : {}),
  })),
};

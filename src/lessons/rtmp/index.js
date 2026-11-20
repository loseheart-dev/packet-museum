import { overview, outro, steps } from './copy.js';
import { addresses, frames } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 130, y: 320 },
  { id: 'router', label: '路由器', kind: 'router', x: 300, y: 246 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 508, y: 321 },
  { id: 'web', label: '推流服务器', kind: 'ingest-server', x: 644, y: 161, labelAt: { x: -49, y: -67, anchor: 'end' } },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'router'], points: [[185, 294], [262, 246]] },
  { nodes: ['router', 'internet'], points: [[339, 246], [453, 306]] },
  { nodes: ['internet', 'web'], points: [[557, 280], [622, 172]] },
];

const frameRanges = [0, 6, 8, 10, 12, 14, 16];

export default {
  meta: { id: 'rtmp', title: 'RTMP', subtitle: '直播推流', group: 2, order: 6, layer: 7 },
  overview, outro, nodes, links, frames, sequenceNodes: ['client', 'web'], timeColumn: true,
  legend: {
    tcp: { label: 'TCP', tone: 'reply' }, handshake: { label: 'RTMP 握手', tone: 'navy' },
    command: { label: '命令', tone: 'referral' }, reply: { label: '应答', tone: 'violet' },
    media: { label: '视频和音频', tone: 'blue' },
  },
  steps: steps.map(([id, title, subtitle, text, facts], i) => ({
    id, title, subtitle, text, facts, wide: true,
    frames: frames.slice(frameRanges[i], frameRanges[i + 1]).map(frame => frame.id),
    ...(i === 0 ? { closeup: ['client'] } : {}),
  })),
};

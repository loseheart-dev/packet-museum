import { overview, outro, steps } from './copy.js';
import { client, frames, server } from './frames.js';

const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 116, y: 302, address: client },
  { id: 'router', label: '路由器', kind: 'router', x: 270, y: 245, address: '192.168.1.1' },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 454, y: 300 },
  { id: 'web', label: 'Web 服务器', kind: 'web-server', x: 521, y: 129, address: server },
];
const links = [
  { nodes: ['client', 'router'], points: [[171, 276], [232, 246]] },
  { nodes: ['router', 'internet'], points: [[309, 245], [403, 291]] },
  { nodes: ['internet', 'web'], points: [[469, 251], [496, 138]] },
];
const cuts = [0, 3, 5, 7, 8, 10, 14];

export default {
  meta: { id: 'tcp', title: 'TCP', subtitle: '传输控制', group: 1, order: 8, layer: 4 },
  overview, outro, nodes, links, frames, viewBox: [0, 0, 665, 420], sequenceNodes: ['client', 'web'],
  legend: {
    control: { label: '握手和 ACK', tone: 'reply' },
    request: { label: '笔记本电脑的数据', title: 'DATA', tone: 'referral' },
    response: { label: '服务器的数据', title: 'DATA', tone: 'violet' },
    finish: { label: '关闭（FIN）', title: 'FIN', tone: 'navy' },
  },
  steps: steps.map((step, i) => ({
    ...step, wide: true, ...(i === 0 ? { closeup: ['client'] } : {}),
    frames: frames.slice(cuts[i], cuts[i + 1]).map(frame => frame.id),
    ...(i === 2 ? { parallel: [['tcp-6', 'tcp-7']], events: [{ node: 'internet', after: 'tcp-6', time: '0.052s', text: '报文段 1 丢失' }] } : {}),
  })),
};

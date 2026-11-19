import { overview, outro, rows, steps } from './copy.js';
import { addresses, hostname, transportFrames } from './frames.js';

const para = ([title, subtitle, text, facts]) => ({ title, subtitle, text, facts });
const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 111, y: 322 },
  { id: 'router', label: '路由器', kind: 'router', x: 310, y: 245 },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 568, y: 332 },
  { id: 'web', label: hostname, kind: 'web-server', x: 644, y: 135, labelAt: { y: -105 } },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'router'], points: [[168, 299], [268, 251]] },
  { nodes: ['router', 'internet'], points: [[352, 245], [506, 298]] },
  { nodes: ['internet', 'web'], points: [[619, 288], [621, 124]] },
];
const path = nodes.map(node => node.id), reverse = [...path].reverse();
const frames = transportFrames.map(({ fromServer, ...frame }, i) => {
  const [time, summary, badge] = rows[i];
  const { application } = frame;
  return { ...frame, id: `tls-${i + 1}`, path: fromServer ? reverse : path, time, summary, badge,
    protocol: application ? 'TLSv1.3' : 'TCP',
    category: !application ? 'tcp' : i <= 7 ? 'handshake' : fromServer ? 'server' : 'browser',
    leadMs: i === 0 ? 2350 : 540, holdMs: application ? 1750 : 500,
  };
});
const starts = [0, 4, 5, 7, 8, 11, frames.length];

export default {
  meta: { id: 'tls', title: 'TLS/SSL', subtitle: '传输层安全', group: 3, order: 32, layer: 6 },
  overview: para(overview), outro: para(outro), nodes, links, frames,
  sequenceNodes: ['client', 'web'],
  legend: {
    tcp: { label: 'TCP', tone: 'reply' }, handshake: { label: 'TLS 握手', tone: 'query' },
    browser: { label: '来自浏览器', tone: 'referral' }, server: { label: '来自服务器', tone: 'reply' },
  },
  steps: steps.map(([id, ...copy], i) => ({ id, ...para(copy),
    frames: frames.slice(starts[i], starts[i + 1]).map(frame => frame.id),
    ...(i === 0 ? { closeup: ['client'] } : { wide: i >= 4 }),
  })),
};

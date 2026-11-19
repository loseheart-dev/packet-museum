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
const titles = ['SYN', 'SYN-ACK', 'ACK', 'CLIENT HELLO', 'SERVER HELLO', '已加密', '已加密', 'FINISHED', '应用数据', 'TICKETS', '应用数据', 'CLOSE_NOTIFY', 'FIN', 'FIN'];
const frames = transportFrames.map(({ fromServer, row, part, ...frame }) => {
  const [time, summary, badge] = rows[row], tls = frame.protocol === 'TLSv1.3';
  return { ...frame, id: `tls-${row + 1}${part ? `-${part + 1}` : ''}`, path: fromServer ? reverse : path, time, summary,
    badge: tls && row !== 5 && row !== 6 ? badge : [], badgeLabel: titles[row], locked: tls && row >= 5,
    category: !tls ? 'tcp' : row <= 7 ? 'handshake' : fromServer ? 'server' : 'browser',
    leadMs: row === 0 ? 2350 : row === 6 ? 700 : 540 + part * 160, holdMs: tls ? 1750 : 500,
  };
});
const ranges = [0, 4, 5, 7, 8, 11, 14];
const ids = (start, end) => frames.filter((_, i) => transportFrames[i].row >= start && transportFrames[i].row < end).map(frame => frame.id);
const hello = ids(3, 4), cert = ids(5, 7), response = ids(10, 11);
const notes = {
  1: [{ after: 'tls-5', node: 'client', time: '0.052s', text: '已算出共享密钥' }],
  2: [{ after: 'tls-7', node: 'client', time: '0.052s', text: '证书链通向受信任的根' }],
};

export default {
  meta: { id: 'tls', title: 'TLS/SSL', subtitle: '传输层安全', group: 3, order: 32, layer: 6 },
  overview: para(overview), outro: para(outro), nodes, links, frames,
  sequenceNodes: ['client', 'web'], timeColumn: true,
  fieldNames: { 服务器名称: '服务器名称（SNI）', 支持版本: '提供的版本', 选中版本: '商定的版本', 公钥: '密钥共享', 公钥长度: '密钥共享长度' },
  reassembly: [
    { frames: hello, protocol: 'TLSv1.3', application: 'tls', summary: rows[3][1] },
    { frames: ids(4, 7), protocol: 'TLSv1.3', application: 'tls', summary: 'Server Hello 与后续加密握手', separateRows: true },
    { frames: response, protocol: 'TLSv1.3', application: 'tls', summary: rows[10][1] },
  ],
  legend: {
    tcp: { label: 'TCP', tone: 'reply' }, handshake: { label: 'TLS 握手', tone: 'teal' },
    browser: { label: '来自浏览器', tone: 'referral' }, server: { label: '来自服务器', tone: 'violet' },
  },
  steps: steps.map(([id, ...copy], i) => ({ id, ...para(copy),
    frames: ids(ranges[i], ranges[i + 1]), events: notes[i],
    ...(i === 0 ? { parallel: [hello] } : i === 2 ? { parallel: [cert] } : i === 4 ? { parallel: [response] } : {}),
    ...(i === 0 ? { closeup: ['client'] } : { wide: i >= 4 }),
  })),
};

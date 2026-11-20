import { overview, outro, steps } from './copy.js';
import { addresses, messages, url } from './frames.js';

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

const ids = (...names) => names.flatMap(name => messages[name].map(frame => frame.id));
const clientHello = ids('client-hello'), serverHello = ids('server-hello'), response = ids('response');

export default {
  meta: { id: 'https', title: 'HTTPS', subtitle: '安全的 HTTP', group: 3, order: 2, layer: 7 },
  overview, outro, nodes, links, frames: Object.values(messages).flat(),
  sequenceNodes: ['client', 'resolver', 'web'],
  fieldNames: { 服务器名称: '服务器名称（SNI）', 支持版本: '提供的版本', 公钥: '密钥共享' },
  reassembly: ['client-hello', 'server-hello', 'response'].map(name => ({
    frames: ids(name), protocol: 'TLSv1.3', application: 'tls', summary: messages[name][0].summary,
  })),
  legend: {
    dns: { label: 'DNS', tone: 'blue' }, tcp: { label: 'TCP', tone: 'reply' },
    handshake: { label: 'TLS 握手', tone: 'teal' },
    request: { label: 'HTTP 请求', tone: 'referral' }, reply: { label: 'HTTP 响应', tone: 'violet' },
  },
  steps: [
    { id: 'request', ...steps[0], nodes: ['client', 'router'], closeup: ['client'], holdMs: 3500,
      events: [{ node: 'client', atMs: 250, text: url }] },
    { id: 'dns', ...steps[1], nodes: ['client', 'router', 'internet', 'resolver'], closeup: ['client', 'router'],
      frames: ids('query', 'reply') },
    { id: 'tcp', ...steps[2], wide: true, frames: ids('syn', 'syn-ack', 'ack') },
    { id: 'tls', ...steps[3], wide: true, frames: ids('client-hello', 'server-hello', 'finished'), parallel: [clientHello, serverHello],
      events: [{ node: 'client', after: serverHello.at(-1), time: '0.093s', text: '证书有效' }] },
    { id: 'exchange', ...steps[4], wide: true, frames: ids('request', 'tickets', 'response'), parallel: [response] },
    { id: 'render', ...steps[5], nodes: ['client'] },
  ],
};

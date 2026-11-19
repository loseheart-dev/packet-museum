import { addresses, frameBytes } from './frames.js';
import { badges, outro, steps, summaries, times } from './copy.js';

const para = ([title, subtitle, text, facts]) => ({ title, subtitle, text, facts });
const nodes = [
  { id: 'client', label: '客户端', kind: 'pc', x: 116, y: 302 },
  { id: 'gateway', label: '路由器', kind: 'router', x: 270, y: 245 },
  { id: 'resolver', label: 'DNS 解析器', kind: 'dns-server', x: 454, y: 126, labelAt: { x: -45, y: -54, gap: 17, anchor: 'end' } },
  { id: 'root', label: '根服务器', kind: 'dns-server', x: 601, y: 226, scale: .86, labelAt: { y: -104, gap: 15 } },
  { id: 'tld', label: '.com 顶级域服务器', kind: 'dns-server', x: 672, y: 287, scale: .86, labelAt: { x: 10, y: 25, addressX: 0, fontSize: 15 } },
  { id: 'auth', label: '权威服务器', kind: 'dns-server', x: 573, y: 370, scale: .86, labelAt: { y: 25 } },
  { id: 'internet', label: '互联网', kind: 'cloud', x: 454, y: 300 },
].map(node => ({ ...node, address: addresses[node.id] }));

const links = [
  { nodes: ['client', 'gateway'], points: [[171, 276], [232, 246]] },
  { nodes: ['gateway', 'internet'], points: [[309, 245], [403, 291]] },
  { nodes: ['internet', 'resolver'], points: [[448, 245], [448, 141]] },
  { nodes: ['internet', 'root'], points: [[498, 263], [574, 224]] },
  { nodes: ['internet', 'tld'], points: [[519, 292], [636, 279]] },
  { nodes: ['internet', 'auth'], points: [[506, 318], [548, 356]] },
];

const paths = [
  ['client', 'gateway', 'internet', 'resolver'], ['resolver', 'internet', 'root'], ['root', 'internet', 'resolver'],
  ['resolver', 'internet', 'tld'], ['tld', 'internet', 'resolver'], ['resolver', 'internet', 'auth'],
  ['auth', 'internet', 'resolver'], ['resolver', 'internet', 'gateway', 'client'],
];
const categories = ['query', 'query', 'referral', 'query', 'referral', 'query', 'reply', 'reply'];
const shots = [[2350, 2420], [1250, 1750], [650, 3750], [1600, 1650], [650, 5700], [1250, 1650], [650, 2050], [600, 1150]];
const frames = paths.map((path, i) => ({
  id: `dns-${i + 1}`, path, bytes: frameBytes(i, path[0], path.at(-1)), application: 'dns', protocol: 'DNS',
  time: times[i], summary: summaries[i], badge: badges[i], category: categories[i], leadMs: shots[i][0], holdMs: shots[i][1],
}));
const stepFrames = [[0], [1, 2], [3, 4], [5, 6], [7]];
const visibleNodes = ['client', 'gateway', 'internet', 'resolver', 'root', 'tld', 'auth'];

export default {
  meta: { id: 'dns', title: 'DNS', subtitle: '域名系统', group: 2, order: 13, layer: 7 },
  overview: {
    title: 'DNS', subtitle: '域名系统',
    text: 'DNS 把 www.example.com 这样的名字转换成计算机用来互相联系的 IP 地址。没有哪台服务器知道所有名字：整个系统是一个服务器层级，回答会在沿途被缓存，所以大多数查询根本不必走远。',
    facts: [['层', '应用层（第 7 层）'], ['端口', '53，UDP（数据大时用 TCP）'], ['转换', '把名字转换为 IP 地址'], ['层级', '根 → 顶级域 → 权威'], ['缓存', '在每条记录的 TTL 期间'], ['定义于', 'RFC 1034, RFC 1035']],
  },
  outro: para(outro), nodes, links, frames,
  sequenceNodes: ['client', 'resolver', 'root', 'tld', 'auth'],
  legend: {
    query: { label: '查询', title: 'DNS 查询', tone: 'query' },
    referral: { label: '引荐', tone: 'referral' },
    reply: { label: '回答', tone: 'reply' },
  },
  steps: steps.map((step, i) => ({
    id: ['ask', 'root', 'tld', 'authoritative', 'cache'][i], ...para(step),
    frames: stepFrames[i].map(n => frames[n].id),
    nodes: visibleNodes.slice(0, [4, 5, 6, 7, 7][i]), wide: i >= 3,
    ...(i === 0 ? { closeup: ['client'] } : {}),
  })),
};

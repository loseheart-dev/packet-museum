# 编写课程

一期每门课只新增 `src/lessons/<id>/`。`src/main.js` 用 `import.meta.glob` 自动发现 `index.js`，同 ID 的 `meta` 会替换 `src/catalog.js` 的占位数据；不改目录清单、路由、引擎和公共测试。

```text
src/lessons/dns/    # 完整示例：5 步、8 帧
  index.js         # default export：元数据、拓扑、图例、步骤与帧清单
  copy.js          # 可选：从参考资料核对过的讲解、时间、摘要
  frames.js        # 可选：用字段和构造器生成 Uint8Array
  test.mjs         # 可选：用 node:test 写独立的协议断言，npm test 自动运行
```

## 导出契约

单一 `export default { meta, overview, nodes, links, steps, frames, ... }`；在 Node 和 Vite 中都能导入，课程文件不要使用 DOM、`import.meta.glob`、`?raw` 或动态网络请求。

| 数据 | 必填 | 可选 |
| --- | --- | --- |
| `meta` | `{ id, title, subtitle, group, order, layer }` | ID 须与目录名一致。`group`: `1` 基础、`2` 应用、`3` 安全；同组按 `order` 升序；`layer` 为 OSI 层号。复用占位项的值。 |
| `overview` / `outro` | `overview: { title, text }` | `subtitle`, `facts: [[名称, 值], ...]`；`outro` 可整个省略，省略时结束后保留末步详情。 |
| `nodes[]` | `{ id, label, kind, x, y }`，坐标为 SVG 单位 | `address`, `scale`（默认 1），`labelAt: { x, y, addressX, gap, anchor, fontSize }` 为相对原点的标签位置；`anchor` 用 `middle` 或 `end`。 |
| `links[]` | `{ nodes: [a, b] }`，一条生成双向车道 | `points: [[ax, ay], [bx, by]]` 是两个方向共用的中心线路端点，按 `nodes` 顺序填写；不填则在相邻节点间自动连接。 |
| `steps[]` | `{ id, title, text, frames: [frameId, ...] }`，数组顺序就是播放顺序 | `subtitle`, `facts`；`nodes` 指定阶段可见节点，默认全显示；`wide: true` 镜头用全景；`closeup: [nodeId, ...]` 在该步首包发送前取近景，`leadMs` 建议至少 2200。 |
| `frames[]` | `{ id, path, bytes, protocol, time, summary }`；`path` 为有序节点 ID，`bytes` 为 `Uint8Array`。 | `format` 默认 `ethernet`；`application` 显式指定上层协议；`addresses: { src, dst }` 用于裸 UDP/TCP 的 IPv4 伪首部；`category`, `badge: [短句, 可选第二行]`, `leadMs: 900`, `holdMs: 840`，`outcome: 'delivered'` 或 `'dropped'`。 |
| 顶层可选项 | — | `sequenceNodes` 自定义时序列的顺序，必须包含所有包的首末节点；`viewBox` 默认 `[0,0,760,460]`；`legend: { 自定义类别: { label, title?, tone } }`，`tone` 取 `query` / `referral` / `reply`。 |

默认图例类别是 `packet`（报文）；自定义图例后为每帧指定 `category`，或者保留 `packet`。时间标签例如 `0.022s`，与播放时间无关。时序使用 `path` 的首末节点，拓扑逐跳播放；显示的源/目的地址从字节解析，裸应用层消息才回退到节点名称。各类 ID 均为短小写 slug；每帧只引用一次，路径的相邻节点必须连通。逐跳转发若字节改变，则用不同帧表示。

设备类型：`pc`（CRT 与机箱）、`router`、`switch`、`cloud`、`server`、`dns-server`、`dhcp-server`、`web-server`；服务器复用机架图，靠节点名称区分。默认全景下建议给硬件轮廓与标签留足边距，避免把节点原点紧贴边缘。

## DNS 例子与字节库

完整实现：[拓扑与步骤](../src/lessons/dns/index.js)、[报文生成](../src/lessons/dns/frames.js)、[与样稿 A 对照的测试](../src/lessons/dns/test.mjs)。DNS 用四个事务还原递归查询、两份引荐、权威回答和最终缓存；根引荐包含 13 个 NS 和 IPv4/IPv6 胶水。下例展示最后的应答如何嵌入 Ethernet 帧：

```js
import { dns, ethernet, ipv4, udp } from '../../lib/bytes/index.js';

const src = '8.8.8.8', dst = '192.168.1.10', question = 'www.example.com';
const payload = dns({
  id: 0x9a3e, flags: 0x8180, questions: [{ name: question }],
  answers: [{ name: question, type: 'A', ttl: 3600, data: '203.0.113.10' }],
});
export const answer = {
  id: 'dns-8', path: ['resolver', 'internet', 'gateway', 'client'],
  protocol: 'DNS', application: 'dns', time: '0.082s', category: 'reply',
  summary: 'Standard query response A 203.0.113.10',
  bytes: ethernet({ src: '00:00:5e:00:53:01', dst: '00:00:5e:00:53:10',
    payload: ipv4({ src, dst, id: 0xd82c, protocol: 17,
      payload: udp({ src, dst, srcPort: 53, dstPort: 54871, payload }) }),
  }),
};
```

`src/lib/bytes/index.js` 的构造器和常用参数：

| 构造器 | 参数或约定 |
| --- | --- |
| `ethernet({ src, dst, type, payload })` | MAC 字符串。IPv4 默认 `0x0800`，ARP 显式 `0x0806`。展示不含填充和 FCS。 |
| `arp({ operation, senderMac, senderIp, targetMac, targetIp })` | Ethernet/IPv4；ARP 请求的 `targetMac` 默认全零。 |
| `ipv4({ src, dst, protocol, payload, id, ttl, flags, dscp, options })` | IPv4 字符串；默认 TTL 64，`flags` 是完整标志/偏移字（默认 DF），`options` 为对齐的字节。自动生成总长和校验和。 |
| `udp({ src, dst, srcPort, dstPort, payload })` / `tcp({ src, dst, srcPort, dstPort, seq, ack, flags, window, urgent, options, payload })` | `src`/`dst` 是伪首部的 IPv4；`flags` 是位掩码，如 TCP SYN `0x02`。未指定的载荷为空，自动算校验和。 |
| `dns({ id, flags, questions, answers, authorities, additionals, compress })` | 问题 `{ name, type?, klass? }`，记录 `{ name, type, klass?, ttl?, data? }`。支持 A/AAAA 的地址字符串、NS/CNAME/PTR 的名称字符串及其他记录的原始数据；自动压缩重复后缀。 |
| `dhcp({ op, xid, mac, flags, ciaddr, yiaddr, siaddr, giaddr, options })` | `options: [[53, 1], [54, '192.0.2.1'], ...]`；数字按消息类型/租期编码，地址写字符串，也接受 `Uint8Array`；自动写 cookie 和结束标记。 |
| `http({ startLine, headers, body })` | `headers` 为键值对数组，`body` 可用字符串或 `Uint8Array`；自动写 CRLF，非空正文若未声明则加 `Content-Length`。可裸用 `format: 'http'`。 |
| `tlsRecord({ type, version, payload })`、`tlsHandshake({ type, body })`、`tlsHello({ server, random, session, suites, extensions })`、`tlsExtension(type, data)` | `random` 为固定的 32 字节教学样本。明文握手封装在 `type: 22` 记录；`type: 23` 的载荷仅标记为密文。可裸用 `format: 'tls'` 或 `'handshake'`。 |

另可用 `text(string)`、`uint(value, length)`、`concat(...arrays)`、`ipv4Address(string)`、`macAddress(string)` 编码其他字段。`inspectFrame(frame)` 返回 `{ layers, src, dst }`；每个 layer 有 `{ label, color, offset, length, fields }`，字段有 `{ label, offset, length, value }`，均以整帧为坐标。教具只处理完整消息，不重组 IPv4 分片、TCP 流或跨 TLS 记录的握手；不做 TLS 解密、HTTP 分块或抓包。

## 核对原站文案

`research/_downloads/` 是本机忽略目录，不会随 Git worktree 同步。在主工作区读取已有的 `index-CNPseYOQ.js`，或引用其绝对路径；不用重新执行下载的 bundle。先用 `rg` 找课程特有词，再按附近的 `steps:[{title:…`、`desc`、`detail`、`facts`、`events` 读取。例：

```sh
rg -o '.{0,120}(Ask the Resolver|a\.root-servers\.net).{0,350}' research/_downloads/index-CNPseYOQ.js
rg -n '询问解析器|根服务器|回答与缓存' research/_downloads/ref-dns.yml design/shared/dns-reference.js
```

英文基础文案在主 bundle；中文在 `zh` 语言包或已下载的页面快照里，主 bundle 找不到中文不代表没有翻译。先用 `rg -o 'zh-[^" ]+\.js'` 确认语言包文件名；本地缺包时用现有快照核对，不把自行翻译称为原站原文。原站字段与合成字节不一致时，按 [研究规格](research/reference-analysis.md) 核对，知识区的地址、flags、TTL 要与实际生成的演示帧一致。

## 自测

```sh
npm ci
npm test
npm run build
npm run dev
```

打开 `/packet-museum/#/lesson/<id>`；可用 `/步骤ID` 后缀静态定位，或 `#/` 返回目录。检查预览、播放与暂停、上一步与单步、时序选包、字段高亮和 390 像素下的目录抽屉。`npm test` 选 `node --test`，无需额外测试依赖；自动发现所有课程，检查字节覆盖、层长度、IPv4/UDP/TCP 校验和、步骤文案和节点/帧引用，且运行可选的 `test.mjs`。

# 参考站拆解与一期课程规格

取证日期：2026 年 11 月 18 日。对象：[Protocol Explorer](https://protocol-explorer-alpha.vercel.app/)。下文将浏览器验证、发布包观察和 Packet Museum 的设计决定分开；不复用参考站代码、译文、美术、样式数值或版式。

## 取证方法

- **浏览器**：以独立 Chromium 会话访问原站。首页是目录与默认 HTTP 工作台，不是独立落地页；先后打开 DNS、TCP，走完两课，再返回 HTTP 并完成播放。三课切换时地址栏始终为 `/`。[首页](../../research/screenshots/01-home.png) · [DNS 字节检查](../../research/screenshots/02-dns-bytes.png) · [DNS 播放完成](../../research/screenshots/03-dns-complete.png) · [TCP 播放完成](../../research/screenshots/04-tcp-complete.png) · [HTTP 播放完成](../../research/screenshots/05-http-complete.png)。这些截图仅作调研证据。
- **静态下载**：默认解析的连接在当前网络超时（`curl: (28) Failed to connect to protocol-explorer-alpha.vercel.app port 443 after 20005 ms: Timeout was reached`）；改用 `curl --resolve protocol-explorer-alpha.vercel.app:443:76.76.21.21`，保留原域名的 TLS 校验，抓到 HTTP 200。浏览器会话使用同一域名地址映射。HTML 引用 `index-CNPseYOQ.js`（SHA-256 `19e285d11f5fa0b1411ec94aaea6cd04531872e8322bb8a46c80e4f92e262834`）和 `index-CwjpA-vk.css`（`330dfe72889cf6fc9b048e50bca6a40f2a5858dfcc24fb76f32f67971e88cd3d`）。本地副本是惰性输入，未执行。以下命令从仓库根目录运行。

```sh
npm install --prefix research/_downloads/tools --ignore-scripts --no-audit --no-fund --fetch-retries=0 rea-agents@5.0.0 @playwright/cli
research/_downloads/tools/node_modules/.bin/rea analyze-javascript-application --help
research/_downloads/tools/node_modules/.bin/rea analyze-javascript-application "$PWD/research/_downloads/site" --format json > research/_downloads/rea-5.json 2> research/_downloads/rea-5.stderr
```

`site/` 保留 `index.html` 和 `assets/` 下的入口 JS/CSS。REA 5.0.0 成功退出：1 个 JS 文件、92,937 个 AST 节点、66 条发现、0 个解析失败，关系图 44 个节点、71 条边。它识别出 `localStorage` 与语言动态导入；未纳入样本的语言分包被报告为未解析。报告里的 `electron-renderer` 是通用分析器节点分类，不是网站使用 Electron 的证据。CSS、标头与课程语义额外按纯文本检查。

另试装 REA 6.9.0：最初指定的运行时包返回 `npm error code ETARGET`、`npm error notarget No matching version found for node-darwin-arm64@24.22.3.`；改用 `node-bin-darwin-arm64` 后，npm 仍以本机 `v24.19.0` 启动，报告 `npm warn EBADENGINE Unsupported engine`（要求 `^22.23.4 || ^24.22.1 || >=26.12.1`）。单独启动尚未安装完成的替代运行时返回 `Malformed Mach-o file (os error 88)`。未升级系统 Node，已终止该次未完成安装；正式静态分析采用已跑通的 5.0.0。

## 页面、目录与功能优先级

**路由**：发布包以一个 HTML 壳和 JS 入口启动；首课硬编码为 HTTP，课程入口调用同一个工作台切换函数，未看到 `pushState`/`replaceState` 选课逻辑，浏览器也未观察到独立课程 URL。Packet Museum 自己使用独立目录与可分享的课程 hash，不复制这种布局。

**参考课程共 39 门**（目录标注基础 11、应用 19、安全 9；以下为目录顺序）：HTTP、HTTPS、WebSocket、WebRTC、SIP、RTSP、RTMP、QUIC、TCP、UDP、IP、BGP、IPv6、DNS、DNS over HTTPS、DNSSEC、DHCP、ICMP、IGMP、NTP、Ethernet、PPPoE、Wi-Fi、WPA3、RADIUS、Captive Portal、SMTP、POP3、IMAP、FTP、SMB、SSH、TLS/SSL、HTTP Proxy、SOCKS5、Reverse Proxy、WireGuard、IPsec、Modbus。ARP 不是独立目录项；一期将它并入以太网课。

| 功能 | 参考站证据 | 优先级与理由 |
| --- | --- | --- |
| 中文目录、课程入口、回目录、可分享地址 | 首页目录与默认 HTTP 已实测；独立课程地址是本站新增设计 | P0：8 课可发现、可导航、可分享 |
| 拓扑、节点高亮和数据包方向 | DNS 实测展示端点、逐段通信和步骤状态 | P0：看清谁发给谁；方向与状态不只靠颜色 |
| 播放 / 暂停、前后单步、跳步、重置与重播 | DNS 实测单包推进、重置、网络／时序切换和播放结束；快捷键面板区分逐包推进与按步跳转 | P0：可停下来讲解，可从任一步重新检查 |
| 步骤讲解、进度与报文日志 | DNS 播放后从概览切为步骤详情，完成后出现总结；表格含时间、源、目的、协议、摘要、大小 | P0：解释当前发生的事，报文可回看 |
| 字节检查器 | 从 DNS 查询行打开，四层封装、字段、十六进制和未知字节标记可见 | P0：能回答示例值来自哪几个字节 |
| 键盘、焦点、窄屏、减少动态效果 | 源码含输入保护、对话框、`aria-live` 和减少动态效果分支 | P0：不依赖鼠标、宽屏或连续动画 |
| 学习状态与视图偏好 | 发布包记录每课 `seen` 和 `done`，还存倍速、主题、语言、视图、目录折叠及专注开关；跨刷新逐项恢复未测 | P1：改善续学，不影响单课；一期播放游标仅存内存 |
| 时序视图、倍速、分类搜索、专注/全屏 | DNS/TCP 时序已实测；目录分类及搜索入口可见 | P1：一期先保证默认拓扑与 8 项目录可用 |
| 主题切换 | CSS 含主题变量，脚本跟随系统偏好或使用手动选择，支持减少主题过渡动效 | P1：本阶段只交两套备选稿，实施一期只选一套 |
| 多语言 | 入口内嵌英语，按 `navigator.languages` 选择并动态导入语言包，写入偏好，更新 `html lang/dir`；浏览器实见中文 | P2：只记录，本站不做翻译框架及语言切换 |
| CSP、PWA | HTML 设 CSP，manifest 可见；常见 SW 地址 404，入口未发现注册 | P0：本站不引外部脚本、无线上抓包；P2：安装与离线分开评估 |

**持久化和安全设置**：`protocol-explorer:progress:v1` 保存课 ID 对应的 `seen[]` 与 `done`，不是网络同步；`theme`、`lang`、`view`、`speed`、`list`、`focus` 分别使用同前缀键。快捷键含空格播放、左右方向键、`S` 单步、`[`/`]` 调速、`V` 换图及 `Ctrl/Cmd+K` 搜索；事件跳过输入目标，报文行有 Enter 路径。尚未完成参考站读屏或全键盘审计。入口 CSP 是 meta，不是实测首页 HTTP 响应头：脚本同源与一项哈希，样式允许内联，连接同源，禁止对象与表单提交。响应另见 HSTS、COOP、Referrer-Policy、Permissions-Policy、X-Frame-Options。Manifest 指定 `standalone`、图标、`start_url` 与 `scope`；未验证安装、离线或既有 Service Worker，不能把 manifest 等同于离线 PWA。

## 单课解剖

| 区域 | 用户看到的行为 | 与数据的关系 |
| --- | --- | --- |
| 课程导航 | 选课并展开步骤；点步骤定位；顶部显示教学层次 | 入口课对象有 ID、协议名、简介、属性、步骤；目录以 ID 关联已看状态 |
| 拓扑 / 时序 | 拓扑复用设备并强调当前路径；时序以端点列和带方向报文行表达同一流程 | 通信端点、路径与报文顺序独立于动画画面；画面帧由 `requestAnimationFrame` 更新 |
| 讲解 / 概览 | 起始为课程简介；推进后显示当前步骤、事实条目与完成总结 | 实测 DNS 第一步讲解先出现，报文日志短暂为空；讲解切换不是“报文已抵达”的同义词 |
| 播放条与日志 | 起始可预览报文；开始后按播放进度呈现；选择报文可检查 | 静态观察：步骤内是事件序列，控制器把步骤展平后按序推进；单包事件和批量发送事件可生成日志，聚焦与注释事件不生成日志。控制器回调同时更新步骤、概览和视图；换课先关闭检查器、释放旧控制器、重置新控制器 |
| 字节检查器 | 查看某个观测点的包，前后切包，按 Ethernet/IPv4/UDP/DNS 选层；字段配值与说明，字节区含十六进制偏移、可打印字符与未知字节占位 | 第一个 DNS 查询的显示布局是 `14+20+8+33=75 B`。分层颜色与字段元数据关联；静态事件处理可用字节范围匹配字段行并滚动到该行。样例值不假装是真实流量，不能由其字节图推断未知的加密内容 |

本站实现时，用一个游标派生当前步骤、在途包、已到包和路径高亮；查看历史包只改变检查器选中项，不跳播。用原生按钮和明确文本表示报文方向、标志和状态。

## 一期 8 课：原创报文规格

下文 `B` 表示字节，位段另标 `bit`；多字节数默认网络字节序。每课至少录制下面的主线。不发真实网络流量，IPv4 示例采用 [RFC 5737](https://www.rfc-editor.org/rfc/rfc5737) 保留网段，域名用 [RFC 2606](https://www.rfc-editor.org/rfc/rfc2606) 的 `.example`。未列具体校验和值时由夹具生成器按报文计算，不把占位值解读成实值。图中的时间用于演示，不是实测 RTT。

### 01 以太网与 ARP：第一次送去同一局域网

节点：工作站 A、交换机、工作站 B（`192.0.2.10`、`192.0.2.20`）。ARP 请求由 A 广播、交换机洪泛；B 对 A 单播回复；A 学到映射后发送一个 Ethernet II 承载 IPv4 的单播帧。ARP 不包在 IP 里；交换机转发依据是 MAC，不是 ARP 缓存。[RFC 826](https://www.rfc-editor.org/rfc/rfc826)、[RFC 894](https://www.rfc-editor.org/rfc/rfc894)。

| 字段 | 长度 | 示例 |
| --- | ---: | --- |
| 目标／源 MAC | 各 6 B | 请求 `ff:ff:ff:ff:ff:ff` / `02:4d:00:00:00:0a`；回复交换对应的 A、B 地址 |
| EtherType | 2 B | `0x0806` ARP / `0x0800` IPv4 |
| HTYPE / PTYPE | 各 2 B | `1` 以太网 / `0x0800` IPv4 |
| HLEN / PLEN | 各 1 B | `6` / `4` |
| OPER | 2 B | `1` 请求 / `2` 回复 |
| SHA / SPA / THA / TPA | `6/4/6/4 B` | `02:4d:00:00:00:0a` / `192.0.2.10` / `00:00:00:00:00:00` / `192.0.2.20`（请求） |
| Pad / FCS | `18/4 B` | 28 B ARP 载荷需补足 46 B；教具标清展示帧不含补齐和链路 FCS，两者不伪造 |

### 02 IPv4：同一包走过两个路由器

节点：A `192.0.2.10`、R1、R2、B `203.0.113.22`。A→R1→R2→B，逐跳比较 Ethernet 地址、IPv4 TTL、头校验和；不做 NAT 或分片，源和目的 IPv4 不变。[RFC 791](https://www.rfc-editor.org/rfc/rfc791)、[RFC 1812 §5.3.1](https://www.rfc-editor.org/rfc/rfc1812#section-5.3.1)。

| 字段 | 长度 | 示例 |
| --- | ---: | --- |
| Version / IHL | 各 4 bit | `4` / `5`，即 `0x45`，无选项 |
| 服务字段 | 1 B | `0x00` |
| Total Length / Identification | 各 2 B | `32`（20 B IPv4 + 12 B UDP） / `0x2b7c` |
| Flags / Fragment Offset | `3/13 bit` | `DF=1`、偏移 `0`，组合 `0x4000` |
| TTL / Protocol | 各 1 B | `64→63→62` / `17`（UDP） |
| Header Checksum | 2 B | `0x1130→0x1230→0x1330`，仅覆盖这个示例 IPv4 头 |
| Source / Destination | 各 4 B | `192.0.2.10` / `203.0.113.22` |

### 03 TCP：三次握手、发数据、四段关闭

节点：客户端 A `:51024`、服务器 B `:8080`。A→B `SYN(Seq=1000)`；B→A `SYN+ACK(9000,1001)`；A→B `ACK(1001,9001)`；A→B 发 4 B `PING`，B→A `ACK(9001,1005)`。A→B `FIN+ACK(1005,9001)`；B→A `ACK(9001,1006)`；B→A `FIN+ACK(9001,1006)`；A→B `ACK(1006,9002)`。ACK 自身不消耗序号，SYN/FIN 各消耗一个；末次 ACK 的主动关闭方进入 TIME-WAIT，四段是选定案例，并非所有关闭都必须恰好四段。[RFC 9293 §§3.1、3.5、3.6](https://www.rfc-editor.org/rfc/rfc9293)。

| 字段 | 长度 | 示例 |
| --- | ---: | --- |
| Source / Destination Port | 各 2 B | `51024` / `8080`（A→B） |
| Sequence / Acknowledgment Number | 各 4 B | SYN+ACK `9000` / `1001` |
| Data Offset / Reserved / Flags | `4/4/8 bit` | `5/0/0x12`（无选项 SYN+ACK）；`0x11` FIN+ACK，`0x10` ACK |
| Window / Checksum / Urgent Pointer | 各 2 B | `4096` / 由 IPv4 伪首部与段计算 / `0`（URG 未置位） |
| Payload | 0 或 4 B | `50 49 4e 47` 为 `PING`；SYN/FIN 示例无数据 |

### 04 UDP：两份独立的温度读数

节点：采样机 A、收集器 B，中间链路。两次发送 `T=21`、`T=22`；第二包在可视化链路中丢失，不出现 UDP 确认或重传。与 TCP 课对读，应用层仍可自定义可靠策略。[RFC 768](https://www.rfc-editor.org/rfc/rfc768)。

| 字段 | 长度 | 示例 |
| --- | ---: | --- |
| Source / Destination Port | 各 2 B | `41000 (0xa028)` / `9000 (0x2328)` |
| Length | 2 B | `12`，8 B 首部 + 4 B 载荷 |
| Checksum | 2 B | `0xb7f5`（A `192.0.2.10` → B `203.0.113.22`、载荷 `T=21`）；覆盖伪首部、UDP 首部及载荷 |
| Payload | 4 B | `54 3d 32 31` / `54 3d 32 32` |

### 05 DNS：查找实验室服务器

节点：CRT 客户端 `192.0.2.20`、递归解析器 `198.51.100.53`。从客户端观察 A 查询 `lab.example`：发请求（`RD=1`，UDP 53040→53）→解析器以已有缓存返回 `203.0.113.42`（UDP 53→53040，`RA=1`）。复问仍是一次请求和一次应答，但上游不用重查，TTL 可递减。根、TLD、权威之间未在一期主线模拟；缓存应答不标权威。[RFC 1035 §§3、4](https://www.rfc-editor.org/rfc/rfc1035)。

| 字段 | 长度 | 示例 |
| --- | ---: | --- |
| ID / Flags | 各 2 B | `0x4c21` / 查询 `0x0100`，响应 `0x8180`（QR、RD、RA，RCODE=0） |
| QDCOUNT / ANCOUNT / NSCOUNT / ARCOUNT | 各 2 B | 查询 `1/0/0/0`，应答 `1/1/0/0` |
| QNAME / QTYPE / QCLASS | `13/2/2 B` | `03 6c 61 62 07 65 78 61 6d 70 6c 65 00` / `0001` A / `0001` IN |
| NAME / TYPE / CLASS | `2/2/2 B` | 应答 `c0 0c` 指向偏移 `0x0c` 的 QNAME / `0001` / `0001` |
| TTL / RDLENGTH / RDATA | `4/2/4 B` | `0000003c`（60 s） / `0004` / `cb 00 71 2a` |

### 06 HTTP/1.1：取回工程台的状态

节点：浏览器客户端和 HTTP 源站；前置 TCP 已连接。客户端 `GET /status` → 服务端 `200 OK` 与 `OK\n`。所有空格、CRLF 与正文字节都有独立范围；展示的是 HTTP 消息，不假定一次消息必等于一个 TCP 报文段。[RFC 9112 §§2–6](https://www.rfc-editor.org/rfc/rfc9112)。

| 字段 | 长度 | 示例 |
| --- | ---: | --- |
| 请求行（含 CRLF） | 22 B | `GET /status HTTP/1.1\r\n` |
| Host 行 / 首部结束 | `19/2 B` | `Host: lab.example\r\n` / `\r\n`，请求共 43 B、无正文 |
| 状态行 | 17 B | `HTTP/1.1 200 OK\r\n` |
| Content-Length 行 / 首部结束 | `19/2 B` | `Content-Length: 3\r\n` / `\r\n` |
| 消息体 | 3 B | `4f 4b 0a`，响应共 41 B |

### 07 TLS 1.3：看得见握手边界，看不见密文内容

节点：客户端与 TLS 服务器；前置 TCP 已连接。不涉及 PSK、0-RTT、重试或客户端证书。客户端 `ClientHello` → 服务端 `ServerHello` → 加密的 `EncryptedExtensions` / `Certificate` / `CertificateVerify` / `Finished` → 客户端验证证书并发加密 `Finished` → 双方交换应用密文。握手消息与记录不保证一一对应。面板将记录头、明文握手字段与密文分开；加密握手名只作为教学注释，不装作从密文解码。[RFC 8446 §§4–5](https://www.rfc-editor.org/rfc/rfc8446)。

| 字段 | 长度 | 示例 |
| --- | ---: | --- |
| Record ContentType / legacy_record_version / Length | `1/2/2 B` | ClientHello `16/0303/0084`（示例记录载荷 132 B）；加密记录外层类型 `17`（均为十六进制） |
| Handshake Type / Length | `1/3 B` | ClientHello `01 / 000080`（128 B 消息体），ServerHello 类型 `02` |
| legacy_version / Random / Session ID | `2/32/1+n B` | `0303` / 固定教学随机样本 / `00`（空）；不是线上密钥 |
| Cipher Suites / Compression Methods | `2+n / 1+n B` | 单套件 `0002 1301` / `01 00`（空压缩方法） |
| Extensions | `2+n B` | 向量长度 `0055`；ClientHello 的 `supported_versions` TLV 7 B、`supported_groups` 8 B、`signature_algorithms` 8 B、X25519 `key_share` 42 B、SNI `lab.example` 20 B |
| ServerHello 选中版本 / 密码套件 | 各 2 B | `0304`（`supported_versions` 内容）/ `1301` |
| Encrypted Record Fragment | 按记录长度 | 密文与认证数据用区间表示，不提供伪解密内容 |

### 08 DHCP：新机器拿到 IPv4 租约

节点：未配置客户机、同一局域网交换机、DHCP 服务器 `192.0.2.1`。Discover 广播→Offer→选定服务器的 Request 广播→ACK，示例客户端设置广播标志，服务器回包也用广播。客户端 UDP `68→67`，服务端 `67→68`；初次广播查询和选择阶段客户端源 IP `0.0.0.0`、目的 `255.255.255.255`，不模拟中继、更新或冲突探测。[RFC 2131 §§2–4](https://www.rfc-editor.org/rfc/rfc2131)、[RFC 2132](https://www.rfc-editor.org/rfc/rfc2132)。

| 字段 | 长度 | 示例 |
| --- | ---: | --- |
| op / htype / hlen / hops / xid / secs / flags | `1/1/1/1/4/2/2 B` | `1`（请求，回应为 `2`）/ `1/6/0` / `0x196745ab` / `0` / `0x8000` |
| ciaddr / yiaddr / siaddr / giaddr | 各 4 B | `0.0.0.0` / Offer、ACK 为 `192.0.2.44` / `0.0.0.0` / `0.0.0.0` |
| chaddr / sname / file / Magic Cookie | `16/64/128/4 B` | `02:4d:00:00:00:2c` + 10 B 零；两字符串字段置零；`63 82 53 63` |
| 选项 53 类型 / 50 请求地址 / 54 服务端 ID | `3/6/6 B`（含 TL） | `35 01 {01,02,03,05}` / `32 04 c0 00 02 2c` / `36 04 c0 00 02 01`；50 用在 Request，54 用在 Offer、Request、ACK |
| 选项 51 租期 / 1 掩码 / 3 网关 / 6 DNS / 255 结束 | `6/6/6/6/1 B`（含头） | ACK 提供 `3600 s` / `255.255.255.0` / `192.0.2.1` / `198.51.100.53` / `ff`；单网关、单 DNS |

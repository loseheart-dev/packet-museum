# Packet Museum 一期实施方案

一期交付中文静态教学站：8 门课，离线编排的报文夹具，前端模拟播放，不抓包、不发探测请求、不接后端。目录与课程是不同页面状态；风格从两套样稿中选一套，不要求同时实现两套主题。协议目标见[参考研究与课程规格](research/reference-analysis.md)。下面是后续目录和接口设计，不是本阶段已实现内容。

## 目录与模块职责

```text
index.html                     # 站点 HTML 壳、初始目录入口
src/
  main.js                      # 路由、挂载及销毁当前课程
  catalog.js                   # 固定 8 课的摘要与按需加载映射
  lessons/                     # 每课一份 JSON 夹具
  playback.js                  # 纯状态转换、从时间派生展示状态
  clock.js                     # rAF、可见性、播放暂停、减少动态效果
  decode/                      # DataView 基础读取与各协议解码器
  ui/                          # 目录、拓扑、步骤、日志、字节检查器
  art/                         # 原创设备 SVG，经 Vite 打包
  styles.css
test/                          # 状态机、夹具与浏览器流程验证
.github/workflows/pages.yml    # 测试、构建和上传 Pages artifact
```

原生 ES Modules + Vite；不加组件框架、状态库、动画库。目录只加载摘要；按 ID 从固定映射加载课程，不拿用户输入拼文件路径。拓扑、表格和检查器各自从同一快照更新；时间变化只改在途位置和进度，不在每帧重建 DOM。

## 课程数据 schema

以下为 JSON 文件的逻辑 schema。`*` 表示必填，`?` 表示可省略；数值、关系和长度的约束另列，不能只验证对象外形。

| 对象 | 字段与类型 | 约束 |
| --- | --- | --- |
| `Lesson` | `version*: 1`, `id*: string`, `title*: string`, `intro*: string`, `summary*: string`, `nodes*: Node[]`, `links*: [string,string][]`, `steps*: Step[]` | ID 为短小写 slug；节点、步骤 ID 各自唯一；至少一个步骤，连线端点存在 |
| `Node` | `id*: string`, `label*: string`, `kind*: "pc"\|"router"\|"switch"\|"server"`, `address?: string`, `x*: number`, `y*: number` | `x/y` 为 0–1 的场景坐标，按视口缩放，不改变逻辑路径 |
| `Step` | `id*: string`, `title*: string`, `text*: string`, `durationMs*: integer`, `packets*: Packet[]` | 时长大于 0；每包的开始和结束落在本步骤内；允许无包的讲解步骤 |
| `Packet` | `id*: string`, `label*: string`, `path*: string[]`, `startMs*: integer`, `travelMs*: integer`, `outcome*: "delivered"\|"dropped"`, `wire*: Wire` | 课内包 ID 唯一；路径相邻节点须由 `links` 连接；至少两个节点；`startMs≥0`、`travelMs>0`；丢包仍保留发送侧记录 |
| `Wire` | `format*: "ethernet"\|"ipv4"\|"tcp"\|"udp"\|"dns"\|"http1"\|"tls13"\|"dhcp"`, `hex*: string`, `observedAt*: string` | `hex` 由空白分隔的二位十六进制字节组成，非空、无伪造未知字节；`observedAt` 是路径中的夹具观测点。只提供协议负载时明确标出范围 |

### 完整示例：DNS 缓存命中

采样只包含 DNS 消息，不含 Ethernet/IP/UDP 头；两个设备之间是逻辑连线，不代表一定在同一物理网段。字节是字段值的唯一来源。应用只为示例报文离线播放，不向这些地址发送流量。

```json
{
  "version": 1,
  "id": "dns",
  "title": "DNS：查找实验室服务器",
  "intro": "客户端知道域名，还不知道服务器地址。",
  "summary": "解析器给出了地址与剩余缓存时间。",
  "nodes": [
    { "id": "desk", "label": "CRT 工作站", "kind": "pc", "address": "192.0.2.20", "x": 0.19, "y": 0.57 },
    { "id": "resolver", "label": "递归解析器", "kind": "server", "address": "198.51.100.53", "x": 0.81, "y": 0.57 }
  ],
  "links": [["desk", "resolver"]],
  "steps": [
    {
      "id": "ask",
      "title": "发出 A 查询",
      "text": "工作站请递归解析器查询 lab.example 的 IPv4 地址。",
      "durationMs": 1500,
      "packets": [{
        "id": "q1", "label": "A 查询", "path": ["desk", "resolver"],
        "startMs": 300, "travelMs": 900, "outcome": "delivered",
        "wire": { "format": "dns", "observedAt": "desk", "hex": "4c 21 01 00 00 01 00 00 00 00 00 00 03 6c 61 62 07 65 78 61 6d 70 6c 65 00 00 01 00 01" }
      }]
    },
    {
      "id": "answer",
      "title": "用缓存应答",
      "text": "解析器把 203.0.113.42 和余下 60 秒的缓存期限送回工作站。",
      "durationMs": 1500,
      "packets": [{
        "id": "a1", "label": "A 应答", "path": ["resolver", "desk"],
        "startMs": 300, "travelMs": 900, "outcome": "delivered",
        "wire": { "format": "dns", "observedAt": "desk", "hex": "4c 21 81 80 00 01 00 01 00 00 00 00 03 6c 61 62 07 65 78 61 6d 70 6c 65 00 00 01 00 01 c0 0c 00 01 00 01 00 00 00 3c 00 04 cb 00 71 2a" }
      }]
    }
  ]
}
```

## 播放、同步和键盘

1. 载入课程时累加步骤起点，将包的相对时间换成绝对时间。状态只存 `mode`（就绪／播放／暂停／完成）、`timeMs` 和 `selectedPacketId`。从 `timeMs` 派生步骤、当前路径、在途进度和已出现报文。段动画沿路径按距离插值，`dropped` 在约定路径终点作丢失标记，不伪造应答。“已发送”与“抵达”是独立状态。
2. 播放用 `requestAnimationFrame` 的时间戳推进；暂停或页面隐藏就释放时钟，回前台不补播。前后单步、跳步都先停钟再定位到目标步起点；重置回就绪并清空检查选择，结束后重播从 0 开始。步骤区随课程游标变化，不跟着所选历史包跳转。
3. 初始日志为空，报文一发出就可查；找已发生的包不改变游标。查看中继续播放不会覆写明确选择的报文。缩小视口时解释、日志和字节检查器按阅读顺序纵向排列；拓扑有步骤文字版。
4. 使用原生按钮呈现前后、播放／暂停、重置；走 Tab、Enter、Space 原生路径，不拦截已聚焦控件动作。课程跳转后焦点放到标题，检查器展开与关闭有明确焦点回落，`aria-live` 只播报步骤或完成，不播报每帧。`prefers-reduced-motion` 取消移动插值，以静态起点／终点状态、箭头与日志替代，不改变课程走向。

## 字节解析

- 读取 `Uint8Array` / `DataView`，所有解析器接收有界区间；返回 `{ layers, fields, issues }`。字段至少含 `{ id, label, offset, length, value, description }`，偏移相对整份 `wire`，位字段加掩码；区间半开 `[offset, offset+length)`。缺失或不支持的部分显式标注，不读取越界、不填零代替未知。
- Ethernet 读 EtherType 决定 ARP / IPv4；IPv4 校验 IHL、总长、分片和协议值；TCP 数据偏移和 UDP 长度决定载荷范围。DNS、DHCP、HTTP、TLS 允许从展示层直接进入；需要识别应用层时用夹具的类型，不只猜端口。DNS 名称压缩须限定在当前消息内并检测循环；DHCP TLV 校验长度与结束标记；HTTP/1.1 解析 CRLF、Host 与固定长度消息体；TLS 解析记录及示例中的握手子区间，密文只标记范围。
- 比如 DNS 响应 `ID` 是 `[0,2)`，问题名 `[12,25)`，回答压缩指针在 `[29,31)`，A 记录值在 `[41,45)`。字段选择映射同一段十六进制；选一个字节反向定位字段，多个位字段共享字节时列出候选。移动端用可横向滚动的等宽字节格，站点主视口不溢出。
- 一期按夹具覆盖范围解码，不做任意 pcap 输入、TCP 重组、TLS 解密或协议流量回放。没有捕获到的 FCS、外层首部、密文字段不标为已解析。

## 路由与部署

- 目录 `#/`，课程 `#/lesson/dns`，可选步骤 `#/lesson/dns/answer`。监听 `hashchange`，原生锚点保留浏览器前进后退。无效课程显示找不到与返回目录链接；无效步骤回合法课程起点并说明。深链只定位，不自动播放。打开静态首页即可：hash 不发到服务器，无需 `404.html` 路由补丁。
- GitHub Pages 项目站使用 Vite `base: '/packet-museum/'`；构建产物为 `dist/`。如果仓库最终改名或使用根域名，部署前同步 `base`；图片走 Vite import 或 `import.meta.env.BASE_URL`，不手写根路径 `/assets`。在本地模拟该子路径后检查刷新、资源 URL 和后退。[Vite 静态部署指南](https://vite.dev/guide/static-deploy.html#github-pages)。
- 仓库启用 Pages 的 GitHub Actions 发布源。PR 只跑 `npm ci`、单测、浏览器检查、`npm run build`；主分支推送或手动触发同样的检查，成功后 `configure-pages`、`upload-pages-artifact` 上传 `dist/`，发布作业 `needs` 构建作业，设 `github-pages` 环境并运行 `deploy-pages`。构建权限 `contents: read`，发布作业最小权限 `pages: write`、`id-token: write`，部署串行；Action 版本在实际配置时按官方版本固定。[GitHub Pages 自定义工作流](https://docs.github.com/actions/using-workflows/using-custom-workflows-with-github-pages)。
- 不加 Service Worker；不引用外部字体、跟踪或脚本。检查 `dist/index.html` 的 CSP 与构建兼容性，静态站可在 HTML 壳用 meta 限制脚本、样式和连接来源，不误称 GitHub Pages 会为此配置任意 HTTP 标头。本阶段不实际创建仓库、运行 Actions 或部署。

## 测试与里程碑

| 里程碑 | 工作 | 验收 |
| --- | --- | --- |
| M0：调研与定稿 | 比较两套样稿，确定美术与节点标准 | 1280 / 390 对应截图和 RFC 规格齐全；人工选定一套风格 |
| M1：DNS 垂直切片 | 建 Vite 壳、目录＋hash、两节点拓扑、播放、日志、字节联动 | DNS 29/45 B，`0x4c21` 一致，`c00c` 指回 `lab.example`；鼠标、键盘、窄屏与减少动态模式可走通 |
| M2：补齐课程 | 以太网/ARP、IPv4、TCP、UDP、HTTP、TLS、DHCP | 8 个夹具无重复 ID、非法节点或越界字段；TCP 两段流程、DHCP 4 包、TLS 密文边界逐项复核 |
| M3：上线前验收 | 验证静态构建、键盘、窄屏与 Pages 工作流 | 1280 / 390 无页面横向溢出，旧课停止刷新，直接访问深链和刷新成功；Pages 实际 URL 测通后方可称已部署 |

纯逻辑用 `node:test`：假时钟测暂停、重置、越界和完成，字节测试覆盖正常与截断、DNS 自指针、DHCP 缺长度、TLS 超长记录；从规格独立验证网络字节序、报文长度和已知校验和。浏览器冒烟抽两门课跑目录→深链→播放→暂停→选择历史报文→回目录，并检查 390px、焦点及 `reducedMotion`。第三方依赖只在有真实需要时加入。

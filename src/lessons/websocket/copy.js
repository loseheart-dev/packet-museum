export const overview = {
  title: 'WebSocket 协议', subtitle: '实时更新',
  text: 'WebSocket 在网页和服务器之间保持一条连接，让任何一方都能随时发送消息：聊天、实时比分、游戏、共享文档。它从一个请求升级的普通 HTTP 请求开始；之后，消息装在头部只有几个字节的小帧里来回传送。',
  facts: [['层', '应用层（第 7 层）'], ['端口', '80（ws://）、443（wss://）'], ['开始时为', '一个 HTTP 请求（Upgrade）'], ['之后', '双向帧，随时发送'], ['帧头', '2–14 字节'], ['定义于', 'RFC 6455']],
};

export const outro = {
  title: '连接已关闭', subtitle: '一次请求，之后都是消息',
  text: '一个 HTTP 请求把普通的 TCP 连接变成了双向通道。之后每条消息只多花几个字节的帧头，服务器有话要说就能随时发送。按“重播”可以再看一遍。',
  facts: [['握手', '带 Upgrade 的 GET，然后是 101'], ['最小的帧', '2 字节（一个 ping）'], ['服务器推送', '随时，无需请求'], ['真实网站', 'wss://（在 TLS 内）']],
};

export const steps = [
  {
    id: 'tcp', title: 'TCP 连接', subtitle: '像 HTTP 一样，TCP 连到服务器',
    text: '聊天页面已经打开，是从 www.example.com 加载的。它的脚本调用 new WebSocket("ws://www.example.com/chat")，浏览器先建立一个到 80 端口的普通 TCP 连接。（真实网站使用 wss://，也就是在 TLS 里做同样的事；不加密的 ws:// 让你能读到每个字节。）',
    facts: [['URL', 'ws://www.example.com/chat'], ['端口', '80'], ['传输层', 'TCP']],
  },
  {
    id: 'upgrade', title: '请求升级', subtitle: '带 Upgrade: websocket 的 HTTP 请求',
    text: '浏览器发送一个带 Upgrade: websocket 和 Connection: Upgrade 的 HTTP GET。Sec-WebSocket-Key 是用 base64 写出的 16 个随机字节，服务器必须给出正确的回答。浏览器还提议压缩消息（permessage-deflate）。',
    facts: [['请求', 'GET /chat'], ['请求内容', 'Upgrade: websocket'], ['密钥', '16 个随机字节，base64']],
  },
  {
    id: 'switch', title: '切换协议', subtitle: '101：从此改用 WebSocket',
    text: '服务器回答 101 Switching Protocols。它的 Sec-WebSocket-Accept 是在密钥后面加上一个固定字符串，用 SHA-1 哈希后再写成 base64：证明它理解了请求。它没有接受压缩，所以消息以明文发送。这个连接上的 HTTP 到此结束；从现在起双方都发送 WebSocket 帧。',
    facts: [['状态', '101 Switching Protocols'], ['Accept', '密钥 + 固定字符串的 SHA-1'], ['压缩', '已提议，未接受']],
  },
  {
    id: 'updates', title: '实时更新', subtitle: '小帧，任何一方都可发送',
    text: '你发送 "Hello"：2 字节的帧头、4 字节的掩码密钥和 5 个经过掩码的字节，总共 11 字节，而不是一整个 HTTP 请求。几秒后，服务器在没人请求的情况下推送了 Bob 的消息：连接仍然开着，所以它可以这么做。浏览器发出的帧总是加掩码，服务器发出的帧从不加。',
    facts: [['你发送', '"Hello" (11 bytes)'], ['服务器推送', '"bob: hi there"'], ['掩码', '仅浏览器发出的帧']],
  },
  {
    id: 'keepalive', title: '保持连接', subtitle: 'ping 与 pong',
    text: '半分钟没有消息后，服务器发送一个 ping，免得路上的路由器和防火墙忘掉这条安静的连接。浏览器自动回一个 pong；页面脚本两个都看不到。',
    facts: [['Ping', 'opcode 9，任何一方'], ['pong', 'opcode 10，自动回复'], ['多久一次', '由服务器决定（30 秒）']],
  },
  {
    id: 'close', title: '关闭', subtitle: '每个方向一个关闭帧',
    text: '你离开聊天时，页面脚本以状态 1000（正常关闭）关闭 WebSocket：浏览器发送关闭帧，服务器回一个自己的关闭帧。然后服务器关闭 TCP 连接。（如果直接关闭标签页，会发送 1001，going away。）',
    facts: [['opcode', '8（关闭）'], ['状态', '1000（正常关闭）'], ['之后', 'TCP 关闭']],
  },
];

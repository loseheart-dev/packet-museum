export const overview = {
  title: 'SIP', subtitle: '会话初始协议',
  text: 'SIP 负责在互联网上建立电话通话：办公桌上的电话、电话应用，以及它们背后的运营商。电话先登录运营商的 SIP 服务器。要打给别人时，它发送 INVITE；对方电话响铃并接听，双方商定如何发送语音，之后语音以 RTP 传输。消息是纯文本，和 HTTP 很像。',
  facts: [['层', '应用层（第 7 层）'], ['端口', 'UDP 或 TCP 5060'], ['建立通话', 'INVITE, 180, 200, ACK'], ['语音', 'RTP，由 SDP 描述'], ['这里的编解码器', 'G.711, 64 kbit/s'], ['定义于', 'RFC 3261']],
};

export const outro = {
  title: '通话结束', subtitle: '登记、响铃、通话、挂断',
  text: 'Alice 的电话用一个从未发送过的密码完成登记，通过 SIP 服务器呼叫 Bob 的电话，听到它响铃，然后通过 RTP 通话，直到 Bob 用 BYE 挂断。SIP 只负责建立和结束通话；语音由它自己的数据包传送。按“重播”可以再看一遍。',
  facts: [['请求', 'REGISTER, INVITE, ACK, BYE'], ['语音', '每个方向每秒 50 个包'], ['经由', '运营商的服务器'], ['加密', '无（SIPS 和 SRTP 才加密）']],
};

export const steps = [
  {
    id: 'register', title: '登记', subtitle: '电话告诉服务器自己在哪',
    text: 'Alice 的电话（她笔记本电脑上的一个应用）向运营商的 SIP 服务器登记：alice@example.net 在这里。服务器回复 401 并附上质询，于是电话用质询和密码算出的哈希再请求一次。200 OK：登记有效一小时。',
    facts: [['端口', 'UDP 5060'], ['登录', '是哈希，不是密码'], ['有效期', '3600 s，然后重新登记']],
  },
  {
    id: 'invite', title: '呼叫 Bob', subtitle: '由服务器转发的 INVITE',
    text: 'Alice 拨打 bob@example.net。她的 INVITE 带着 SDP：G.711 音频，发到她的电话。服务器回复 100 Trying，查到 Bob 的电话在哪登记，然后转发 INVITE，加上自己的 Via 和 Record-Route，并在 SDP 中换成自己的地址：语音将经过服务器。',
    facts: [['To', 'sip:bob@example.net'], ['提议 (SDP)', 'G.711，端口 49170'], ['100 Trying', '让 Alice 不再重发']],
  },
  {
    id: 'ringing', title: '响铃', subtitle: '回应沿原路返回',
    text: 'Bob 的电话开始响铃并告知对方：180 Ringing。响应沿着 Via 头部按请求来的路线返回，所以先到服务器，服务器去掉自己的 Via 后转给 Alice。她的电话播放回铃音。',
    facts: [['响应', '180 Ringing'], ['返回路线', 'Via 头部，倒序'], ['Alice 听到', '回铃音']],
  },
  {
    id: 'answered', title: '已接听', subtitle: '200 OK，然后 ACK',
    text: 'Bob 接起电话。他的 200 OK 带着 SDP 应答：G.711，发到他的电话。服务器在转给 Alice 之前再次换成自己的地址。Alice 的电话用 ACK 确认，服务器把它转给 Bob。通话建立了。',
    facts: [['应答 (SDP)', 'G.711，端口 49172'], ['确认方式', 'ACK'], ['语音发往', '服务器，端口 40000、40002']],
  },
  {
    id: 'talking', title: '通话中', subtitle: '语音以 RTP 传输',
    text: '现在是语音：每部电话每 20 ms 通过 UDP 发送一个 RTP 包，里面有 160 字节的 G.711 声音、一个序列号和一个时间戳。数据包先到服务器，再由服务器转给另一部电话。通话期间 SIP 一言不发。',
    facts: [['间隔', '20 ms，160 字节声音'], ['承载方式', '基于 UDP 的 RTP'], ['这期间的 SIP', '无话可说']],
  },
  {
    id: 'bye', title: '挂断', subtitle: 'BYE，然后 200 OK',
    text: 'Bob 挂断：他的电话发送 BYE，按 Record-Route 的要求经过服务器，Alice 的电话回复 200 OK。双方都停止发送语音。这通电话用了四种请求；语音本身从来不属于 SIP。',
    facts: [['请求', 'BYE'], ['回答', '200 OK'], ['之后', 'RTP 停止']],
  },
];

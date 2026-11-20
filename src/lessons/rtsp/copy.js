export const overview = {
  title: 'RTSP', subtitle: '实时流协议',
  text: 'RTSP 是视频播放器、录像机和安防应用从 IP 摄像头获取实时视频的方式。它像一个遥控器：播放器询问摄像头能提供什么，建立一路流，然后说 PLAY，之后说 TEARDOWN，用的是和 HTTP 很像的文本消息。视频本身不走 RTSP：它作为 RTP 单独传输，这里走 UDP。',
  facts: [['层', '应用层（第 7 层）'], ['端口', 'TCP 554'], ['控制命令', 'SETUP, PLAY, TEARDOWN'], ['视频', 'RTP，由 SDP 描述'], ['这里的编解码器', 'H.264'], ['定义于', 'RFC 2326 (2.0: RFC 7826)']],
};

export const outro = {
  title: '看完了', subtitle: '描述、建立、播放、停止',
  text: 'VLC 询问摄像头有什么，用密码的哈希登录，建立一条视频轨道并按下 PLAY。视频以 RTP 包的形式从专用端口到达，一个关键帧分成三块，直到 TEARDOWN 结束会话。按“重播”可以再看一遍。',
  facts: [['请求', '一条 TCP 连接上 6 个'], ['视频', 'RTP, UDP 6970 → 50000'], ['关键帧', '分成 3 个包'], ['会话层', '1185d200，60 s 超时']],
};

export const steps = [
  {
    id: 'options', title: '你能做什么？', subtitle: '在 TCP 连接上发 OPTIONS',
    text: 'VLC 打开 rtsp://192.168.1.64/stream1。它通过 TCP 端口 554 连接摄像头，先发 OPTIONS：你支持哪些命令？摄像头一一列出。和 HTTP 一样，每个请求和回复都是文本；CSeq 头部给它们编号。',
    facts: [['端口', 'TCP 554'], ['询问', 'OPTIONS'], ['编号方式', 'CSeq']],
  }, {
    id: 'describe', title: '描述视频流', subtitle: 'SDP 说明视频是什么',
    text: 'DESCRIBE 请求视频流的描述。摄像头要求先登录：401，附带 digest 质询。VLC 用密码的哈希再请求一次，回复带着 SDP：一条 H.264 视频轨道，RTP 负载类型 96，时钟 90 kHz。',
    facts: [['登录', 'Digest：一个哈希'], ['视频', 'H.264，负载类型 96'], ['轨道', 'trackID=1']],
  }, {
    id: 'setup', title: '建立', subtitle: '商定视频端口',
    text: '针对 trackID=1 的 SETUP 说明如何传送：RTP over UDP，发到笔记本电脑的端口 50000（视频）和 50001（RTCP 报告）。摄像头同意，选好自己的端口 6970 和 6971，并开启会话 1185d200，之后每个请求都要报上它。',
    facts: [['传输层', '基于 UDP 的 RTP'], ['笔记本端口', '50000, 50001'], ['会话层', '1185d200']],
  }, {
    id: 'play', title: '播放', subtitle: '遥控器上的 PLAY 键',
    text: 'PLAY 从现在开始播放（npt=0.000-）。回复告诉 VLC 最先到达的 RTP 序列号和时间戳，好让它把视频排好。从这里开始，视频完全不再经过 RTSP。',
    facts: [['范围', '从现在起'], ['第一个包', 'Seq 27493'], ['视频到达', '经 UDP 端口']],
  }, {
    id: 'video', title: '视频到达', subtitle: '关键帧装在 RTP 包里',
    text: '摄像头把一个关键帧（一整幅画面）分成三个 RTP 包发送：H.264 分片分别标为第一、中间和最后，最后一个包设置标记位。三个包带着同一个 90 kHz 时间戳。随后是只含变化部分的较小帧，每秒 25 帧。',
    facts: [['包数', '一个关键帧 3 个'], ['时间戳', '整帧相同'], ['帧', '每秒 25 帧']],
  }, {
    id: 'teardown', title: '停止', subtitle: 'TEARDOWN 结束会话',
    text: '观看者关闭视频流时，VLC 发送带会话 ID 的 TEARDOWN。摄像头停止发送视频并确认。假如 VLC 直接消失，摄像头在 60 秒收不到它的任何消息后也会停止。',
    facts: [['请求', 'TEARDOWN'], ['会话层', '已结束'], ['否则', '60 s 后超时']],
  },
];

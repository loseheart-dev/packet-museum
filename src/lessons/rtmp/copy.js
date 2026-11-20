export const overview = {
  title: 'RTMP', subtitle: '实时消息协议',
  text: 'RTMP 是大多数主播把直播视频送到平台的方式：OBS 等应用把视频推到推流服务器，服务器再把它变成给观众看的直播流。它为 Flash 而生，却作为上传方式比 Flash 活得更久。所有内容共用一条 TCP 连接：命令、音频和视频，都切成分块。',
  facts: [['层', '应用层（第 7 层）'], ['端口', 'TCP 1935'], ['携带', 'H.264 视频，AAC 音频'], ['命令', '用 AMF0 编码'], ['安全版本', 'RTMPS，基于 TLS'], ['定义于', 'Adobe 规范 (2012)']],
};

export const outro = {
  title: '直播中', subtitle: '已连接、已发布、已推流',
  text: 'OBS 与推流服务器握手，连接到它的 live 应用，拿到 stream 1，并用推流密钥在上面发布。之后视频和音频以分块形式沿同一条 TCP 连接流动，直到主播停止。按“重播”可以再看一遍。',
  facts: [['连接', '一条 TCP，端口 1935'], ['流', 'ID 1'], ['分块', '最多 4,096 字节'], ['加密', '无：RTMPS 才加 TLS']],
};

export const steps = [
  ['handshake', '握手', '先 TCP，再 RTMP 自己的',
    '主播点击“开始推流”。OBS 通过 TCP 端口 1935 连接推流服务器，然后 RTMP 进行自己的握手：每个方向发送版本 3 和 1,536 个随机字节，双方各自把对方的发回去。这只证明两端都说 RTMP；它不加密任何东西。',
    [['端口', 'TCP 1935'], ['版本', '3'], ['每一方', '发送 3,073 字节']]],
  ['connect', '连接', '连到服务器的 live 应用',
    'OBS 把分块大小提到 4,096 字节，并向名为 live 的应用发送 connect，用的是 AMF0，一种来自 Flash 的紧凑二进制格式。服务器设定自己的窗口、带宽和分块大小，并回复 _result：NetConnection.Connect.Success。',
    [['应用', 'live'], ['编码', 'AMF0'], ['分块', '最多 4,096 字节']]],
  ['create-stream', '创建一路流', 'createStream 返回 stream 1',
    '每条消息都写明一个消息流；0 就是连接本身。OBS 释放并宣布自己的推流密钥，然后用 createStream 要一路用来发送的流，三条命令放在一个包里。服务器回复 stream ID 1。',
    [['命令', '一个包里 3 条'], ['询问', 'createStream'], ['得到', 'Stream ID 1']]],
  ['publish', '发布', '推流密钥开播',
    'publish 报上推流密钥，也就是说明这是谁的频道的秘密。RTMP 没有加密，所以密钥以明文传过去；平台更推荐 RTMPS，即走 TLS 的同一协议。服务器核对密钥并回复 NetStream.Publish.Start。',
    [['发送', '推流密钥'], ['加密', '无（RTMPS 才加 TLS）'], ['回答', 'Publish.Start']]],
  ['media', '画面和声音', '元数据、设置，然后是帧',
    'OBS 描述这路流：1920×1080，每秒 30 帧，H.264 视频，AAC 音频。它先发解码器的设置，再发一个约 30 KB 的关键帧，切成 4,096 字节的分块。之后帧在同一条 TCP 连接上源源不断。',
    [['视频', 'H.264, 1920×1080, 30 fps'], ['音频', 'AAC，48 kHz 立体声'], ['关键帧', '30 KB 分 8 块']]],
  ['stop', '停止推流', 'FCUnpublish 和 deleteStream',
    '主播点击“停止推流”时，OBS 为 stream 1 发送 FCUnpublish 和 deleteStream。服务器回复 NetStream.Unpublish.Success，并为观众结束直播。然后 OBS 关闭 TCP 连接。',
    [['命令', 'FCUnpublish, deleteStream'], ['回答', 'Unpublish.Success'], ['之后', 'TCP 关闭']]],
];

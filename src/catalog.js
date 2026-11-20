export const groups = ['全部', '基础', '应用', '安全'];

export const catalog = [
  { id: 'http', title: 'HTTP', subtitle: '超文本传输', group: 2, order: 1, layer: 7 },
  { id: 'https', title: 'HTTPS', subtitle: '安全的 HTTP', group: 3, order: 2, layer: 7 },
  { id: 'websocket', title: 'WebSocket', subtitle: '双向 Web 消息', group: 2, order: 2, layer: 7 },
  { id: 'webrtc', title: 'WebRTC', subtitle: '浏览器视频通话', group: 2, order: 3, layer: 7 },
  { id: 'sip', title: 'SIP', subtitle: '网络电话', group: 2, order: 4, layer: 7 },
  { id: 'rtsp', title: 'RTSP', subtitle: 'IP 摄像头视频流', group: 2, order: 5, layer: 7 },
  { id: 'rtmp', title: 'RTMP', subtitle: '直播推流', group: 2, order: 6, layer: 7 },
  { id: 'quic', title: 'QUIC', subtitle: '基于 UDP 的 HTTP/3', group: 1, order: 7, layer: 4 },
  { id: 'tcp', title: 'TCP', subtitle: '传输控制', group: 1, order: 8, layer: 4 },
  { id: 'udp', title: 'UDP', subtitle: '用户数据报', group: 1, order: 9, layer: 4 },
  { id: 'ipv4', title: 'IP', subtitle: '互联网协议', group: 1, order: 10, layer: 3 },
  { id: 'bgp', title: 'BGP', subtitle: '网络之间的路由', group: 1, order: 11, layer: 7 },
  { id: 'ipv6', title: 'IPv6', subtitle: '地址配置、邻居发现', group: 1, order: 12, layer: 3 },
  { id: 'dns', title: 'DNS', subtitle: '域名系统', group: 2, order: 13, layer: 7 },
  { id: 'dhcp', title: 'DHCP', subtitle: '动态主机配置', group: 2, order: 16, layer: 7 },
  { id: 'icmp', title: 'ICMP', subtitle: '互联网控制消息', group: 1, order: 17, layer: 3 },
  { id: 'igmp', title: 'IGMP', subtitle: '组播与电视频道', group: 1, order: 18, layer: 3 },
  { id: 'ntp', title: 'NTP', subtitle: '网络时间协议', group: 2, order: 19, layer: 7 },
  { id: 'ethernet', title: 'Ethernet', subtitle: '帧与交换机', group: 1, order: 20, layer: 2 },
  { id: 'tls', title: 'TLS/SSL', subtitle: '传输层安全', group: 3, order: 32, layer: 6 },
];

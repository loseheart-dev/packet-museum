export const groups = ['全部', '基础', '应用', '安全'];

export const catalog = [
  { id: 'http', title: 'HTTP', subtitle: '超文本传输', group: 2, order: 1, layer: 7 },
  { id: 'tcp', title: 'TCP', subtitle: '传输控制', group: 1, order: 8, layer: 4 },
  { id: 'udp', title: 'UDP', subtitle: '用户数据报', group: 1, order: 9, layer: 4 },
  { id: 'ipv4', title: 'IP', subtitle: '互联网协议', group: 1, order: 10, layer: 3 },
  { id: 'dns', title: 'DNS', subtitle: '域名系统', group: 2, order: 13, layer: 7 },
  { id: 'dhcp', title: 'DHCP', subtitle: '动态主机配置', group: 2, order: 16, layer: 7 },
  { id: 'ethernet', title: 'Ethernet', subtitle: '帧与交换机', group: 1, order: 20, layer: 2 },
  { id: 'tls', title: 'TLS/SSL', subtitle: '传输层安全', group: 3, order: 32, layer: 6 },
];

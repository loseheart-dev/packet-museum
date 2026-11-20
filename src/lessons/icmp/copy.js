export const overview = {
  title: 'ICMP', subtitle: '互联网控制消息协议',
  text: 'ICMP 是网络回报情况的方式：路由器报告某个数据包的时间用完了，服务器报告某个端口上没有程序在监听。ping 和 traceroute 这样的工具就是用这些消息构建的。它在 IP 内部传输，但不携带应用数据。',
  facts: [['层', '网络层（第 3 层）'], ['承载于', 'IP（协议 1）'], ['消息', '一个类型和一个代码'], ['工具', 'ping, tracert / traceroute'], ['常常', '被防火墙过滤'], ['定义于', 'RFC 792 (IPv6: RFC 4443)']],
};

export const outro = {
  title: '网络作出了回答', subtitle: '应答、超时和错误',
  text: '回显请求测出了往返时间，小 TTL 的数据包让路径上的每个路由器报出了自己，关闭的端口也立刻得到了回报。按“重播”可以再看一遍。',
  facts: [['往返', '34 ms'], ['路径', '12 个路由器，服务器在第 13 跳'], ['用到的类型', '8、0、11 和 3'], ['应答的 TTL', '52（64 − 12 个路由器）']],
};

export const steps = [
  {
    id: 'ping', title: 'Ping', subtitle: '回显请求',
    text: '“ping -n 1 203.0.113.10”发送一个 ICMP 回显请求（不带参数的 ping 发送四个，间隔一秒）：类型 8，代码 0，带有标识符、序列号和 32 字节的填充数据。服务器的系统会自行回答，不需要任何应用程序。',
    facts: [['类型，代码', '8，0（回显请求）'], ['数据', '32 字节（Windows）'], ['TTL', '128']],
    frames: ['ping-request'], closeup: ['client'],
  },
  {
    id: 'echo-reply', title: '回显应答', subtitle: '往返时间',
    text: '服务器返回一个回显应答，类型 0，带有相同的标识符、序列号和数据。ping 显示所用时间和应答到达时的 TTL：“bytes=32 time=34ms TTL=52”。',
    facts: [['类型，代码', '0，0（回显应答）'], ['往返', '34 ms'], ['到达时的 TTL', '52（64 − 12 个路由器）']],
    frames: ['ping-reply'], events: [{ node: 'client', after: 'ping-reply', text: 'TIME=34MS TTL=52' }],
  },
  {
    id: 'ttl-1', title: 'TTL 1', subtitle: '第一个路由器回答',
    text: '“ping -n 1 -i 1”以 TTL 1 发送同样的请求。家里的路由器把它降到 0，因此必须丢弃这个数据包，并从自己的地址返回一条超时（Time Exceeded）消息：“Reply from 192.168.1.1: TTL expired in transit.”',
    facts: [['发送时的 TTL', 'TTL 1'], ['丢弃者', '路由器 192.168.1.1'], ['类型，代码', '11，0（超时）']],
    frames: ['hop-1-probe', 'hop-1-expired'],
  },
  {
    id: 'ttl-2', title: 'TTL 2', subtitle: '下一个路由器回答',
    text: '使用“-i 2”时，家里的路由器把 TTL 降到 1 并转发。互联网服务提供商的第一个路由器把它降到 0，并从 198.51.100.1 回报。家里的路由器像对待任何回复一样，把这条回报转换后交给笔记本电脑。',
    facts: [['发送时的 TTL', 'TTL 2'], ['丢弃者', 'ISP 路由器 198.51.100.1'], ['类型，代码', '11，0（超时）']],
    frames: ['hop-2-probe', 'hop-2-expired'],
    events: [{ node: 'internet', after: 'hop-2-probe', text: '第 2 跳 · 198.51.100.1' }],
  },
  {
    id: 'traceroute', title: '这就是 traceroute', subtitle: 'TTL 1、2、3 … 直到到达',
    text: 'tracert 把这个过程自动化：每次把 TTL 加一，每跳发送三个探测，并列出是谁回报的。第 3 到 12 跳也是同样的道理，TTL 为 13 时请求终于到达服务器，服务器正常回答。',
    facts: [['跳数', '12 个路由器，然后是服务器'], ['每跳', '3 个探测'], ['在 Linux 上', 'traceroute 发送 UDP']],
    frames: ['hop-13-probe', 'hop-13-reply'],
  },
  {
    id: 'unreachable', title: '不可达', subtitle: '那个端口上没有程序在监听',
    text: '一个应用向 9999 端口发送一个 UDP 数据报，而那里没有程序在监听。服务器无法投递，于是回复目的不可达（Destination Unreachable），代码 3（端口不可达），并引用该数据报的开头部分。许多防火墙则会悄悄丢弃这类数据包。',
    facts: [['类型，代码', '3，3（端口不可达）'], ['其他代码', '0 网络，1 主机，4 太大'], ['防火墙', '常常不作回应']],
    frames: ['udp-probe', 'port-unreachable'],
  },
];

export const overview = {
  title: 'TCP', subtitle: '传输控制',
  text: 'TCP 把互联网“尽力而为”的数据包投递，变成可靠、有序的字节流。它给每个字节编号，确认收到的内容，重传丢失的部分，并控制发送方的节奏，使对方和网络都不至于被压垮。',
  facts: [['层', '传输层（第 4 层）'], ['连接', '三次握手'], ['可靠性', '序列号 + ACK'], ['恢复', '重传'], ['头部', '20–60 字节'], ['定义于', 'RFC 9293']],
};

export const steps = [
  { id: 'open', title: '打开连接', subtitle: '三次握手',
    text: 'curl 已经知道服务器的地址。在传输任何数据之前，双方各自选定起始序列号并加以确认：SYN、SYN-ACK、ACK。这里的编号是相对值；真实编号从一个随机值开始。',
    facts: [['服务器', '203.0.113.10，80 端口'], ['客户端端口', '49152（临时端口）'], ['标志', 'SYN → SYN-ACK → ACK']] },
  { id: 'send', title: '发送数据', subtitle: '每个字节都有编号',
    text: 'curl sends its 78-byte HTTP request: bytes 1 to 78. The server’s ACK number, 79, is the next byte it expects, which means everything before it has arrived.',
    facts: [['Sent', '78 bytes (seq 1–78)'], ['ACK', '79 = next byte expected'], ['Flags', 'PSH, ACK']] },
  { id: 'loss', title: '返回两个报文段', subtitle: '其中一个丢失了',
    text: 'The server answers with 2,920 bytes: two full segments of 1,460 bytes, the most that fits in one packet here, sent back to back. The first is dropped somewhere on the internet; the second gets through.',
    facts: [['Segment 1', 'bytes 1–1460 (lost)'], ['Segment 2', 'bytes 1461–2920'], ['Segment size', '1,460 bytes (MSS)']] },
  { id: 'sack', title: '发现缺口', subtitle: '带 SACK 的重复 ACK',
    text: 'Bytes 1461–2920 arrive, but 1–1460 never did. An ACK can only count bytes received in order, so the laptop repeats ACK 1 at once and adds a SACK block saying it already holds 1461–2920.',
    facts: [['ACK', '1 (still waiting for byte 1)'], ['SACK', 'holds bytes 1461–2920'], ['Sent', 'At once, not delayed']] },
  { id: 'resend', title: '重传缺口', subtitle: '只重传缺失的字节',
    text: 'The SACK tells the server exactly what is missing, so it resends just segment 1, and the laptop acknowledges everything. Had no ACK come back at all, timers would have stepped in: a probe after about two round trips, then a retransmission timeout (at least 200 ms on Linux).',
    facts: [['Resent', 'bytes 1–1460 only'], ['Next ACK', '2921 (everything)'], ['curl saw', 'Every byte, in order']] },
  { id: 'close', title: '关闭连接', subtitle: '双方各自道别',
    text: 'curl is done, so it closes. Each direction closes on its own: the laptop sends FIN and the server acknowledges it, then the server sends its own FIN and the laptop acknowledges that. The laptop keeps the connection’s details for a while (TIME-WAIT).',
    facts: [['Closed by', 'A FIN from each side'], ['Order', 'FIN → ACK → FIN → ACK'], ['Then', 'Laptop waits (TIME-WAIT)']] },
];

export const outro = {
  title: '连接已关闭', subtitle: '每个字节都有着落',
  text: 'TCP 打开连接，给每个字节编号并确认，发现缺口后只重传缺失的报文段，然后干净地关闭了两个方向。curl 按顺序收到了每个字节，完全没察觉到丢包。按“重播”可以再看一遍。',
  facts: [['报文段', '14（丢失 1 个，重传 1 个）'], ['送达字节数', '上行 78，下行 2,920'], ['发现丢包的方式', '重复 ACK + SACK'], ['总时间', '0.148 s']],
};

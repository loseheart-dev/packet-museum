// Copy from the reference bundle and its zh language pack.
export const overview = {
  title: "QUIC", subtitle: "基于 QUIC 的 HTTP/3",
  text: "QUIC 是一种较新的传输协议，运行在 UDP 之上，内置 TLS 1.3。它的头几个数据包同时完成传输握手和加密握手，所以一次往返后就能发出页面请求。它同时承载许多流，一个包丢了也不会拖住其他流，而且换了网络也能继续。HTTP/3 就是运行在 QUIC 上的 HTTP。",
  facts: [["层","传输层（第 4 层）"], ["运行在","UDP，端口 443"], ["加密","始终是 TLS 1.3"], ["握手","1 次往返（再次访问时 0 次）"], ["流","多条，彼此独立"], ["定义于","RFC 9000, RFC 9114"]],
};
export const outro = {
  title: "页面已送达", subtitle: "一次往返，然后就是请求",
  text: "QUIC 把传输握手和 TLS 握手合并成一次往返，所以请求在第一个数据包之后 36 ms 就发出了；用 TCP 加 TLS 则要多等一倍时间。头几个数据包之后的一切都是加密的，连每个数据包的头部也大部分加密。按“重播”可以再看一遍。",
  facts: [["往返次数","请求前 1 次（TCP + TLS：2 次）"], ["数据报","10"], ["传输层","UDP，端口 443"], ["丢失的数据包","只拖住一条流"]],
};
export const steps = [{
  title: "选择 HTTP/3", subtitle: "上次访问说可以",
  text: "上次访问时，服务器回复了 Alt-Svc: h3=\":443\"，意思是它也在 UDP 端口 443 上支持 HTTP/3（DNS 也可以用 HTTPS 记录说明这一点）。所以这一次浏览器跳过 TCP，直接用 QUIC。",
  facts: [["得知途径","Alt-Svc 头部，或 DNS"], ["传输层","基于 UDP 443 的 QUIC"], ["加密","内置 TLS 1.3"]],
}, {
  title: "Initial 数据包", subtitle: "一开始就发 Client Hello",
  text: "没有单独的 TCP 握手：最开始的数据包就带着 TLS Client Hello。加上抗量子的密钥共享，它有 1,880 字节，一个数据包装不下，所以占满两个 Initial 数据包。每个数据报都至少填充到 1,200 字节；服务器最多只能回送收到数据量的三倍，这样伪造的源地址就无法把它变成放大器。",
  facts: [["数据报","2 × 1,250 字节"], ["携带","TLS Client Hello"], ["能读吗？","能（Initial 密钥是公开的）"]],
}, {
  title: "Server Hello", subtitle: "然后是证书，已加密",
  text: "服务器在一个 Initial 数据包里回复 Server Hello。现在双方都能算出握手密钥，所以剩下的部分（证书、证书签名和 Finished）放在只有笔记本电脑能读的 Handshake 数据包里送来。四个数据报，远低于笔记本电脑发送量的三倍。",
  facts: [["Initial","Server Hello"], ["握手","证书、签名、Finished"], ["服务器上限","收到字节数的 3 倍"]],
}, {
  title: "Finished + GET", subtitle: "一次往返后发出请求",
  text: "笔记本电脑检查证书并发送 Finished，同时在一个 1-RTT 数据包里发出第一个 HTTP/3 请求：流 0 上的一个 HEADERS 帧，头部用 QPACK 压缩。第一个数据包之后一次往返，请求就已经上路；TCP 加 TLS 则需要两次。",
  facts: [["往返次数","1 次（TCP + TLS：2 次）"], ["请求","流 0 上的 HEADERS"], ["头部","已压缩（QPACK）"]],
}, {
  title: "响应", subtitle: "在自己的流上",
  text: "服务器确认握手结束（HANDSHAKE_DONE），并在流 0 上回答：先是头部，然后是页面。每个请求都有自己的流，所以一个包丢了只会拖住它所属的那条流。用 TCP 时，缺一个报文段就会卡住后面的所有内容。",
  facts: [["HTTP/3","QUIC 流上的帧"], ["丢失的数据包","拖住一条流"], ["加密","除头部几个比特外全部加密"]],
}, {
  title: "新网络", subtitle: "靠 ID 识别，而不是地址",
  text: "QUIC 连接靠连接 ID 识别，而不是靠地址和端口。如果笔记本电脑从 Wi-Fi 换到手机热点，地址变了，但连接继续：服务器检查新路径后继续工作。而且下次访问时，浏览器可以在最开始的数据包里就发出请求（0-RTT）。",
  facts: [["识别依据","连接 ID"], ["新地址","连接继续"], ["下次访问","0-RTT：立即发请求"]],
}];

export const summaries = [
  "Initial，CRYPTO（Client Hello，第 1 部分）",
  "Initial，CRYPTO（Client Hello，第 2 部分），PADDING",
  "Initial, ACK, CRYPTO (Server Hello)",
  "Handshake，CRYPTO（证书，第 1 部分）",
  "Handshake，CRYPTO（证书，第 2 部分）",
  "Handshake, CRYPTO (Certificate Verify, Finished)",
  "Initial, ACK, PADDING; Handshake, ACK, CRYPTO (Finished)",
  "1-RTT, HTTP/3 HEADERS (GET /)",
  "1-RTT, HANDSHAKE_DONE, HTTP/3 HEADERS (200), DATA",
  "1-RTT, ACK",
];
export const contents = [
  ["CRYPTO：Client Hello，1,880 字节中的第 1–1,203 字节", "SNI www.example.com，ALPN h3，X25519MLKEM768 密钥共享"],
  ["CRYPTO：Client Hello，第 1,204–1,880 字节", "PADDING，补到 1,250 字节"],
  ["ACK：数据包 0–1 已到达", "CRYPTO：Server Hello，带着它那一半密钥（1,120 字节）"],
  ["CRYPTO：Encrypted Extensions、Certificate（开头）"],
  ["CRYPTO：Certificate（续）"],
  ["CRYPTO：Certificate Verify、Finished"],
  ["ACK：服务器的 Initial 已到达", "PADDING，补到 1,250 字节"],
  ["ACK：Handshake 数据包已到达", "CRYPTO: Finished"],
  ["STREAM 2：SETTINGS（控制流）", "STREAM 0：HEADERS，GET /（QPACK 压缩）"],
  ["HANDSHAKE_DONE：握手结束", "STREAM 3: SETTINGS", "STREAM 0：HEADERS 200，然后是 DATA：页面（1,000 字节）"],
  ["ACK：响应已到达"],
];

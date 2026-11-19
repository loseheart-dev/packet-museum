export const steps = [["询问解析器","笔记本电脑把问题交出去","浏览器需要 www.example.com 的 IP 地址，而浏览器和 Windows 都没有缓存。笔记本电脑向分配给它的递归解析器 8.8.8.8 发送一个问题，请它完成整个查找（期望递归）。",[["问题","www.example.com，类型 A"],["询问对象","8.8.8.8（递归）"],["标志","RD（期望递归）"]]],
  ["根服务器","指明通往 .com 的路","解析器的缓存是空的（它刚启动），所以从顶端开始。根服务器不知道这个地址，但知道哪些服务器负责 .com，于是用一个引荐来回答。许多解析器只向它发送“com”，而不是完整的名字。",[["服务器","a.root-servers.net"],["根服务器","13 个名字，1,000 多个任播站点"],["回复","引荐（13 台 .com 服务器）"]]],
  [".COM 顶级域服务器","指明通往 example.com 的路","解析器询问其中一台 .com 服务器。它们也不存储每个网站的地址，但知道每个 .com 域名使用哪些名称服务器，所以这次回复又是一个引荐，并附上了这些服务器的地址（胶水记录）。",[["服务器","a.gtld-servers.net"],["知道",".com 域名的名称服务器"],["回复","引荐 + 胶水地址"]]],
  ["权威服务器","给出真正的答案","最后，解析器询问 example.com 自己的名称服务器，它保存着这个域名的记录。它用 A 记录回答，并把回复标记为权威。可以缓存多久由域名所有者决定：这里是 3600 秒。",[["服务器","ns1.example.com"],["回答","A 203.0.113.10"],["标志","AA（权威），TTL 3600"]]],
  ["回答与缓存","笔记本电脑拿到地址","解析器把答案发回笔记本电脑，并保留一份副本。接下来一小时里它都能立即回答这个名字，这就是为什么 HTTP 课程中的查询只用了 24 ms。笔记本电脑也会缓存它。",[["回答","A 203.0.113.10"],["标志","RD，RA（可用递归）"],["缓存方","解析器和笔记本电脑"]]]];
export const outro = ["名字已解析","并记住一小时","解析器从空缓存出发，从根走到 .com，再到 example.com 自己的服务器，然后回答了笔记本电脑。在 TTL 到期之前，对这个名字的下一次查询会直接由缓存回答。按“重播”可以再看一遍。",[["查询次数","4（笔记本电脑 1 次，解析器 3 次）"],["总时间","0.094 s"],["传输层","UDP，53 端口"],["缓存时长","3600 s (TTL)"]]];
export const times = ["0.000s","0.012s","0.017s","0.022s","0.032s","0.042s","0.062s","0.082s"];
export const summaries = [
  "Standard query A www.example.com",
  "Standard query A www.example.com",
  "引荐：com. NS ×13（含胶水记录）",
  "Standard query A www.example.com",
  "引荐：example.com. NS ×2（含胶水记录）",
  "Standard query A www.example.com",
  "响应 A 203.0.113.10（权威）",
  "Standard query response A 203.0.113.10"
];
export const badges = [["A? www.example.com","标志：RD"],
  ["A? www.example.com"],
  ["没有回答：去问 .com","com. NS a.gtld-servers.net …"],
  ["A? www.example.com"],
  ["没有回答：去问 example.com","example.com. NS ns1.example.com"],
  ["A? www.example.com"],
  ["www.example.com A 203.0.113.10","TTL 3600 · AA 标志"],
  ["A 203.0.113.10 · TTL 3600","标志：RD RA"]];

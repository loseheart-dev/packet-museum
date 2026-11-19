'use strict';
const $ = id => document.getElementById(id);
const octets = JSON.parse($('frames').textContent).map(bytes => Uint8Array.from(bytes));
const lesson = [
  ['请求递归解析','让解析器代查地址','浏览器与操作系统都没有 lab.example 的地址。工作站向配置好的递归解析器提问，请它查到底，而不是只指一个方向。',[['问题','lab.example · A'],['解析器','198.51.100.53'],['标志','RD = 1']]],
  ['根区指路','找到 .example 的负责方','解析器也没有缓存，于是从根区开始。根区不保存实验室主机的地址，只返回负责顶级域的名称服务器；实际解析器也可能只问顶级域，不把完整名称交给根区。',[['服务器','示例根节点'],['分工','只维护顶级域委派'],['返回','NS 引荐及胶水地址']]],
  ['顶级域指路','找出 lab.example 的权威服务器','解析器根据第一份引荐访问 .example。这个服务器不保存主机的 A 记录，但知道 lab.example 交给谁管理，并提供继续查询所需的胶水地址。',[['服务器','ns.tld.example'],['委派目标','ns.lab.example'],['返回','NS 引荐及胶水地址']]],
  ['向权威查询','取回主机的 IPv4 地址','解析器询问 lab.example 的权威服务器。它从自己的区域记录读取 A 记录，用 AA 标明这是权威应答；本例给记录设定 60 秒的缓存期限。',[['服务器','ns.lab.example'],['A 记录','203.0.113.42'],['标志 / TTL','AA = 1 / 60 秒']]],
  ['交回并缓存','让工作站拿到最终地址','解析器沿原事务把结果交还工作站，并留下缓存。只要记录还未到期，后续查询就可直接命中；客户端的系统解析器也可以缓存结果。',[['A 记录','203.0.113.42'],['标志','RD = 1，RA = 1'],['缓存','递归解析器及客户端']]]
];
const nodes = {
 client:['工作站', [[174,322],[211,329],[330,329],[360,287]]], gateway:['家用路由器'], resolver:['递归解析器'],
 root:['根服务器', [[386,216],[365,168],[337,120]]], tld:['顶级域服务器', [[478,243],[532,185],[566,108]]], auth:['权威服务器', [[479,283],[548,292],[620,295]]]
};
const scenario = [
 ['client','resolver',0,'查询','RD=1 · A lab.example','工作站只发这一个递归请求。它希望收到最终答案，而不是自己去问根服务器。'],
 ['resolver','root',1,'查询','向根区查询 A lab.example','本地缓存未命中。解析器从根区开始迭代询问；此包的 RD 位为 0。'],
 ['root','resolver',1,'引荐','委派 .example · NS + 胶水','根区不知道实验室主机的地址。它给出 .example 的 NS 记录和对应地址，让解析器知道下一站。'],
 ['resolver','tld',2,'查询','向 .example 查询 A lab.example','解析器使用引荐里的地址，向顶级域服务器继续问同一个问题。'],
 ['tld','resolver',2,'引荐','委派 lab.example · NS + 胶水','顶级域服务器把 lab.example 区委派给权威服务器。附加区的胶水记录给出可连接的 IPv4 地址。'],
 ['resolver','auth',3,'查询','向权威服务器查询 A lab.example','解析器向权威服务器发出最后一次迭代查询；这个事务使用独立的查询 ID。'],
 ['auth','resolver',3,'应答','权威 A · 203.0.113.42 · TTL 60','权威服务器返回 A 记录，设置 AA 标志。解析器可以按记录的 TTL 缓存这个结果。'],
 ['resolver','client',4,'应答','递归 A · 203.0.113.42 · TTL 60','解析器用最初的事务 ID 回答工作站，并置 RA 位表明自己支持递归；它不是该区的权威。']
];
const words = ['全部','链路','网络','传输','应用','安全'];
const courses = [
 ['Ethernet / ARP','同网段寻址',1,2], ['IPv4','逐跳转发',2,3], ['TCP','握手与关闭',3,4], ['UDP','无连接数据报',3,4],
 ['DNS','名字如何变成地址',4,7], ['HTTP','请求与响应',4,7], ['TLS 1.3','建立加密通道',5,6], ['DHCP','分配 IPv4 租约',4,7]
];
const time = ['0.000','0.008','0.020','0.021','0.035','0.036','0.052','0.053'];
// Screen time (framing, flight, and reading hold) is independent of trace timestamps.
const shots = [[850,1650,4700],[650,2050,1750],[550,1900,3750],[650,2100,1650],[550,1900,5700],[650,2050,1650],[500,1900,2050],[850,2200,1150]];
const stepStarts = lesson.map((_, step) => scenario.findIndex(packet => packet[2] === step));
if (scenario.length !== octets.length || scenario.length !== shots.length || stepStarts.some(i => i < 0)) {
  throw new Error('DNS 教学报文、镜头或步骤数据不完整');
}
const svgNS = 'http://www.w3.org/2000/svg';
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width:760px)');
const pad = n => String(n).padStart(2,'0');
const hex = (n,len=2) => n.toString(16).padStart(len,'0');
const ip = (b,i) => b.slice(i,i+4).join('.');
const mac = (b,i) => Array.from(b.slice(i,i+6), n => hex(n)).join(':');
const word = (b,i) => b[i]*256+b[i+1];
const tag = n => `#${pad(n+1)}`;
const routeText = ([a,b]) => `${nodes[a][0]} → ${nodes[b][0]}`;
let index = 0, elapsed = 0, frame = null, last = null, running = false, finished = false, started = false, view = 'network';
let revealed = -1, phase = '', inspected = 0;
let layer = 0, category = 0, expanded = true, selectedField = null;
const network = $('network-svg'), sceneNodes = [...network.querySelectorAll('[data-node]')];
const bounds = Object.fromEntries(sceneNodes.map(node => {
  const b = node.getBBox(), matrix = node.transform.baseVal.getItem(0).matrix;
  return [node.dataset.node,[b.x+matrix.e,b.y+matrix.f,b.x+b.width+matrix.e,b.y+b.height+matrix.f]];
}));
const full = [0,0,760,460];
const nodeBoxes = Object.values(bounds);
let camera = { from:full, to:full, current:full };
let pathLength = 0;

for (const [id, [, points]] of Object.entries(nodes)) if (points) {
  const cable = document.createElementNS(svgNS,'polyline');
  cable.setAttribute('points', points.map(p => p.join(',')).join(' '));
  cable.setAttribute('class','wire');
  cable.dataset.link = id;
  $('cables').append(cable);
}

function currentPath() {
  const [from,to] = scenario[index];
  if (from === 'client') return nodes.client[1];
  if (to === 'client') return [...nodes.client[1]].reverse();
  return from === 'resolver' ? nodes[to][1] : [...nodes[from][1]].reverse();
}

function frameNodes(ids) {
  const boxes = ids.map(id => bounds[id]);
  const x = Math.min(...boxes.map(b => b[0])), y = Math.min(...boxes.map(b => b[1]));
  const w = Math.max(...boxes.map(b => b[2])) - x + 96, h = Math.max(...boxes.map(b => b[3])) - y + 80;
  const aspect = network.clientHeight ? network.clientWidth/network.clientHeight : 760/460;
  const width = Math.max(w,h*aspect), height = width/aspect;
  return [x+(w-96-width)/2,y+(h-80-height)/2,width,height];
}

function aimCamera(snap=false) {
  const [from,to,step] = scenario[index];
  const participants = [from,to];
  if (participants.includes('client')) participants.push('gateway');
  if (step === 1 && index === 1) participants.push('gateway','tld');
  camera.from = camera.current;
  camera.to = !started ? full : frameNodes(participants);
  if (snap) camera.from = camera.to;
}

const clamp = n => Math.max(0,Math.min(1,n));
const ease = n => n*n*(3-2*n);
function badgeOffset({x,y}) {
  const [left,top,width,height] = camera.current;
  const offsets = [[0,-19],[0,19],[43,0],[-43,0],[42,-20],[-42,-20]];
  return offsets.find(([dx,dy]) => {
    const l=x+dx-37, r=x+dx+37, t=y+dy-12, b=y+dy+12;
    return l>=left && r<=left+width && t>=top && b<=top+height && !nodeBoxes.some(([a,c,d,e])=>l<d && r>a && t<e && b>c);
  }) || offsets[0];
}
function paint() {
  const [lead,flight] = shots[index];
  const progress = clamp((elapsed-lead)/flight);
  const nextPhase = !started ? '待播放' : finished ? '已完成' : elapsed < lead ? '准备发送' : progress < 1 ? '传输中' : '已抵达';
  if (nextPhase !== phase) {
    phase = nextPhase;
    $('stage-phase').textContent = nextPhase;
    $('packet').setAttribute('visibility',!started || phase === '准备发送' ? 'hidden' : 'visible');
    if (started && elapsed >= lead && index > revealed) { revealed = index; renderTrace(); }
  }
  const moving = !motion.matches;
  const zoom = moving ? ease(clamp(elapsed/Math.max(470,lead))) : 1;
  camera.current = camera.from.map((value,i) => value+(camera.to[i]-value)*zoom);
  if (view === 'network') {
    network.setAttribute('viewBox',camera.current.join(' '));
    const p = $('active-wire').getPointAtLength(pathLength*(!started ? .34 : moving ? ease(progress) : progress === 1 ? 1 : .5));
    $('packet').setAttribute('transform',`translate(${p.x} ${p.y})`);
    $('packet-badge').setAttribute('transform',`translate(${badgeOffset(p).join(' ')})`);
    const glow = $('arrival');
    glow.setAttribute('cx',p.x); glow.setAttribute('cy',p.y);
    glow.setAttribute('r',moving ? 12+30*clamp((elapsed-lead-flight)/390) : 17);
    glow.setAttribute('opacity',progress === 1 && started ? (moving ? .85-.57*clamp((elapsed-lead-flight)/390) : .7) : 0);
    const [left,top,w,h] = camera.current;
    sceneNodes.forEach(node => {
      const [x1,y1,x2,y2] = bounds[node.dataset.node];
      node.style.opacity = clamp(Math.min(x1-left,y1-top,left+w-x2,top+h-y2)/24);
      node.classList.toggle('received',progress === 1 && node.dataset.node === scenario[index][1]);
    });
  }
  if (view === 'sequence') {
    const row = $(`sequence-row-${index}`);
    row.querySelector('.seq-arrow').style.strokeDashoffset = started && moving ? 1-progress : 0;
    row.classList.toggle('flying',started && moving && progress < 1);
  }
}

function renderCatalog() {
  const q = $('search').value.trim().toLowerCase();
  let count = 0;
  [...$('courses').children].forEach((item,i) => {
    const [name,desc,group,level] = courses[i];
    item.hidden = (category !== 0 && category !== group) || (layer !== 0 && layer !== level) || !(name + desc).toLowerCase().includes(q);
    if (!item.hidden) count++;
  });
  $('count').textContent = `${pad(count)} 项`;
  $('no-results').hidden = count > 0;
  $('steps').hidden = !expanded;
  $('dns-course').setAttribute('aria-expanded',expanded);
  $('course-chevron').textContent = expanded ? '⌄' : '›';
  [...$('filters').children].forEach((button,i) => button.setAttribute('aria-pressed',i === category));
  [...$('osi').querySelectorAll('button')].forEach((button,i) => {
    button.setAttribute('aria-pressed',i+1 === layer);
    button.classList.toggle('course-level',i === 6 && layer === 0);
  });
}

$('osi').insertAdjacentHTML('beforeend',Array.from({length:7},(_,i) => `<button type="button" aria-label="OSI 第 ${i+1} 层" data-layer="${i+1}">${i+1}</button>`).join(''));
$('filters').innerHTML = words.map((word,i) => `<button type="button" data-category="${i}">${word}</button>`).join('');
const stepList = lesson.map(([title],i) => `<li><button type="button" data-step="${i}"><span class="step-num">${i+1}</span>${title}</button></li>`).join('');
$('courses').innerHTML = courses.map(([name,desc],i) => {
  const label = `<span class="course-symbol" aria-hidden="true">${i === 4 ? '●' : '○'}</span><span><b>${name}</b><small>${desc}</small></span>`;
  return i === 4 ? `<li class="course"><button type="button" class="course-title dns" id="dns-course" aria-controls="steps">${label}<span id="course-chevron" class="chevron" aria-hidden="true"></span></button><ol class="steps" id="steps">${stepList}</ol></li>`
    : `<li class="course"><div class="course-title">${label}</div></li>`;
}).join('');
$('rows').innerHTML = '<tr id="empty-trace"><td colspan="7">还没有捕获报文</td></tr>' + scenario.map(([, , , kind, label],i) => {
  const b = octets[i];
  return `<tr data-index="${i}"><td><button type="button" aria-label="定位到报文 ${i+1}">${tag(i)}</button></td><td>${time[i]} s</td><td>${ip(b,26)}</td><td>${ip(b,30)}</td><td><span class="dot ${kind === '应答' ? 'answer' : kind === '引荐' ? 'referral' : ''}"></span>DNS</td><td>${label}</td><td>${b.length} B</td></tr>`;
}).join('');

function renderTrace() {
  const visible = revealed;
  const activeIndex = Math.min(index,visible);
  $('empty-trace').hidden = visible >= 0;
  const log = $('log');
  const rows = $('rows').querySelectorAll('[data-index]');
  rows.forEach((row,i) => {
    row.hidden = i > visible;
    row.classList.toggle('current',i === activeIndex);
    if (i === activeIndex) row.setAttribute('aria-current','true'); else row.removeAttribute('aria-current');
  });
  const row = rows[activeIndex];
  if (row && row.offsetTop + row.offsetHeight > log.scrollTop + log.clientHeight) log.scrollTop = row.offsetTop + row.offsetHeight - log.clientHeight;
  if (row && row.offsetTop < log.scrollTop + 23) log.scrollTop = Math.max(0,row.offsetTop - 23);
  const seq = $('sequence');
  seq.querySelectorAll('[data-seq]').forEach((row,i) => {
    row.classList.toggle('pending',i > visible);
    row.classList.toggle('current',i === activeIndex);
    row.setAttribute('tabindex',i > visible ? '-1' : '0');
    if (i !== index) {
      row.classList.remove('flying');
      row.querySelector('.seq-arrow').style.strokeDashoffset = 0;
    }
  });
  if (view === 'sequence') {
    const active = $(`sequence-row-${index}`);
    const box = seq.getBoundingClientRect(), item = active.getBoundingClientRect();
    if (item.bottom > box.bottom || item.top < box.top) seq.scrollTop += item.top-box.top-64;
  }
}

function drawSequence() {
  const width = mobile.matches ? 360 : 720, y0 = 34, gap = mobile.matches ? 31 : 43;
  const ids = ['client','resolver','root','tld','auth'];
  const inset = mobile.matches ? 39 : 64;
  const x = id => inset + ids.indexOf(id)*(width-inset*2)/4;
  const rows = scenario.map(([from,to,step,kind],i) => {
    const y = y0+23+i*gap, dx = x(to)-x(from), color = kind === '引荐' ? 'referral' : kind === '应答' ? 'answer' : 'query';
    return `<g id="sequence-row-${i}" data-seq="${i}" class="seq-row ${color}" tabindex="0" role="button" aria-label="检查报文 ${i+1}，${routeText([from,to])}">
      <rect class="seq-hit" x="0" y="${y-23}" width="${width}" height="${gap}"/>
      <text class="seq-num" x="6" y="${y+4}">${pad(i+1)}</text>
      <line class="seq-arrow" pathLength="1" x1="${x(from)+Math.sign(dx)*4}" x2="${x(to)-Math.sign(dx)*9}" y1="${y}" y2="${y}"/>
      <path class="seq-tip" d="M ${x(to)-Math.sign(dx)*10} ${y-4} L ${x(to)-Math.sign(dx)*3} ${y} L ${x(to)-Math.sign(dx)*10} ${y+4} Z"/>
      <text class="seq-caption" x="${(x(from)+x(to))/2}" y="${y-9}">${tag(i)} ${kind}</text></g>`;
  }).join('');
  const positions = ids.map(id => `<line class="seq-lifeline" x1="${x(id)}" x2="${x(id)}" y1="${y0}" y2="${y0+gap*8+9}"/><text class="seq-label" x="${x(id)}" y="22">${nodes[id][0]}</text>`).join('');
  $('sequence').innerHTML = `<svg viewBox="0 0 ${width} ${y0+gap*8+12}" aria-label="DNS 时序，时间由上往下" role="group">${positions}${rows}</svg>`;
}

function render(snap=false) {
  const packet = scenario[index], [from,to,step,kind,,explain] = packet;
  $('stage-status').textContent = started ? `${tag(index)} ${kind} · ${nodes[from][0]} → ${nodes[to][0]}` : 'DNS · 递归查询';
  $('packet-tag').textContent = `${tag(index)} ${kind}`;
  $('packet').dataset.kind = kind;
  $('active-wire').setAttribute('d','M' + currentPath().map(p=>p.join(' ')).join(' L'));
  pathLength = $('active-wire').getTotalLength();
  sceneNodes.forEach(node => node.classList.toggle('active',[from,to].includes(node.dataset.node) || packet.includes('client') && node.dataset.node === 'gateway'));
  aimCamera(snap);
  $('step-stamp').textContent = finished ? '课程完成 · 5 / 5' : `步骤 ${step+1} / ${lesson.length} · 报文 ${tag(index)}`;
  $('step-title').textContent = finished ? '解析完成' : lesson[step][1];
  $('step-text').textContent = finished ? '从本地缓存未命中开始，解析器依次查过根区、顶级域和权威服务器。下一次查询若仍在 TTL 内，就不需要重新走这条路径。' : lesson[step][2];
  $('step-route').textContent = explain;
  $('step-facts').innerHTML = lesson[step][3].map(([name,value])=>`<div><dt>${name}</dt><dd>${value}</dd></div>`).join('');
  [...$('steps').querySelectorAll('button')].forEach((button,i) => {
    button.classList.toggle('done',i < step || finished);
    if (i === step) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current');
  });
  renderTrace(); paint();
  $('prev').disabled = index === 0;
  $('next').disabled = index === scenario.length-1;
  updatePlay();
  if (view === 'packet') { inspected = index; renderBytes(); }
}

function updatePlay() { $('play').textContent = running ? 'Ⅱ 暂停' : finished ? '↻ 重播' : '▶ 播放'; }
function pause() { running = false; cancelAnimationFrame(frame); frame = null; last = null; updatePlay(); }
function jump(i, autoplay=false) {
  pause(); index = Math.max(0,Math.min(scenario.length-1,i));
  started = true; finished = false;
  elapsed = autoplay ? 0 : shots[index][0]+shots[index][1];
  revealed = autoplay ? index-1 : index;
  render(!autoplay);
  if (autoplay) play();
}
function reset() {
  pause(); index = 0; elapsed = 0; started = false; finished = false; revealed = -1; render(true);
}
function tick(now) {
  if (!running) return;
  if (last !== null) elapsed += Math.min(now-last,100)*Number($('rate').value);
  last = now;
  const duration = shots[index].reduce((sum,ms) => sum+ms,0);
  if (elapsed >= duration) {
    if (index === scenario.length-1) { finished = true; pause(); render(true); return; }
    elapsed -= duration; index++; render();
  }
  paint();
  frame = requestAnimationFrame(tick);
}
function play() {
  if (running) { pause(); return; }
  if (!started || finished) { reset(); started = true; render(); }
  running = true; updatePlay(); frame = requestAnimationFrame(tick);
}

const groups = [['Ethernet',14,'ether'],['IPv4',20,'ip'],['UDP',8,'udp'],['DNS',0,'dns']];
function readName(b,pos) {
  const labels = []; let end; const seen = new Set();
  while (pos < b.length && !seen.has(pos)) {
    seen.add(pos);
    const length = b[pos++];
    if (length === 0) return [labels.join('.') || '.',end ?? pos];
    if ((length & 192) === 192 && pos < b.length) { end ??= pos+1; pos = 42+((length & 63)*256+b[pos]); }
    else if (length > 63 || pos+length > b.length) break;
    else { labels.push(String.fromCharCode(...b.slice(pos,pos+length))); pos += length; }
  }
  throw new Error('样例 DNS 名称无效');
}
function fieldsOf(b) {
  const uint = (i,n) => n === 1 ? b[i] : word(b,i), H = (i,n=2) => `0x${hex(uint(i,n),n*2)}`;
  const flag = word(b,44);
  const result = [
    [['目的 MAC',0,6,mac(b,0),'此观察链路上的下一跳接口。'],['源 MAC',6,6,mac(b,6),'当前发帧网口的硬件地址。'],['类型',12,2,H(12),'0x0800 表示后面是 IPv4。']],
    [['版本 / IHL',14,1,`${b[14]>>4} / ${(b[14]&15)*4} B`,'无选项，头长 20 字节。'],['DSCP / ECN',15,1,H(15,1),'本例未设置服务等级或拥塞标记。'],['总长度',16,2,`${word(b,16)} B`,'包含 IP 首部和 UDP 数据报。'],['标识',18,2,H(18),'同一 IP 数据报的分片共享此值。'],['标志 / 偏移',20,2,`DF=${(b[20]>>6)&1} · 偏移 ${word(b,20)&8191}`,'本例不分片。'],['TTL',22,1,b[22],'路由转发时递减。'],['上层协议',23,1,`${b[23]} · UDP`,'载荷是 UDP 数据报。'],['首部校验和',24,2,H(24),'只校验 IPv4 首部。'],['源 IPv4',26,4,ip(b,26),'IP 源端地址。'],['目的 IPv4',30,4,ip(b,30),'IP 目的端地址。']],
    [['源端口',34,2,word(b,34),'发送端的 UDP 端口。'],['目的端口',36,2,word(b,36),'查询投递到 53，应答返回客户端端口。'],['UDP 长度',38,2,`${word(b,38)} B`,'首部与 DNS 负载合计。'],['UDP 校验和',40,2,H(40),'覆盖伪首部、UDP 首部与数据。']],
    [['事务 ID',42,2,H(42),'同一对查询与应答使用相同 ID。'],['标志',44,2,`${H(44)} · ${[flag&0x8000?'QR':'',flag&0x0400?'AA':'',flag&0x0100?'RD':'',flag&0x0080?'RA':''].filter(Boolean).join(' ') || '查询'}`,'QR 标识应答；AA 为权威，RD 请求递归，RA 表示可递归。'],['问题数',46,2,word(b,46),'Question 区的问题数量。'],['回答数',48,2,word(b,48),'Answer 区的资源记录数量。'],['权威数',50,2,word(b,50),'Authority 区的资源记录数量。'],['附加数',52,2,word(b,52),'Additional 区的资源记录数量。']]
  ];
  const dns = result[3];
  const [question,end] = readName(b,54);
  dns.push(['查询名',54,end-54,question,'每个标签前先写长度，末尾字节为 00。'],['查询类型',end,2,`${word(b,end)} · A`,'请求 IPv4 地址记录。'],['查询类',end+2,2,`${word(b,end+2)} · IN`,'互联网类。']);
  let pos = end+4;
  for (const [offset, label] of [[48,'回答'],[50,'权威'],[52,'附加']]) for (let i=0;i<word(b,offset);i++) {
    const [owner,next] = readName(b,pos), type = word(b,next), ttl = new DataView(b.buffer).getUint32(next+4), length = word(b,next+8), data = next+10;
    dns.push([`${label}名称`,pos,next-pos,owner,'压缩指针以 DNS 消息起点为基准。'],['记录类型',next,2,`${type} · ${type === 1 ? 'A' : 'NS'}`,'A 保存 IPv4，NS 指向域名服务器。'],['记录类',next+2,2,`${word(b,next+2)} · IN`,'本记录属于互联网类。'],['TTL',next+4,4,`${ttl} s`,'此记录还可缓存的秒数。'],['记录数据长度',next+8,2,`${length} B`,'紧接其后的 RDATA 字节数。'],[`${label}数据`,data,length,type === 1 ? ip(b,data) : readName(b,data)[0],'引荐给出服务器名及胶水，回答给出主机地址。']);
    pos = data+length;
  }
  return result;
}

function highlight(button) {
  selectedField?.classList.remove('selected');
  selectedField = button;
  button?.classList.add('selected');
  const start = Number(button?.dataset.start), end = start+Number(button?.dataset.length);
  const dump = $('dump');
  dump.querySelectorAll('[data-byte]').forEach(span => span.classList.toggle('selected',Number(span.dataset.byte)>=start && Number(span.dataset.byte)<end));
  const first = dump.querySelector('.byte.selected');
  if (first) {
    const byte = first.getBoundingClientRect(), area = dump.getBoundingClientRect();
    if (byte.top < area.top || byte.bottom > area.bottom) dump.scrollTop += byte.top-area.top-8;
  }
}

function renderBytes() {
  const b = octets[inspected], fields = fieldsOf(b);
  $('frame-head').textContent = `${tag(inspected)} · ${routeText(scenario[inspected])} · ${b.length} B · 不含链路 FCS`;
  $('layers').innerHTML = groups.map(([label,len,color],i) => `<button type="button" data-group="${i}" style="flex:${len || b.length-42} 1 49px;--layer:var(--${color})"><b>${label}</b><small>${len || b.length-42} B</small></button>`).join('');
  $('fields').innerHTML = fields.map((items,i) => `<section id="group-${i}"><h3 style="--layer:var(--${groups[i][2]})">${groups[i][0]} / ${items.length} 项</h3>${items.map(([name,start,length,value,explain]) => `<button type="button" class="field" data-start="${start}" data-length="${length}"><b>${name}</b><code>${value}</code><small>${explain}</small></button>`).join('')}</section>`).join('');
  const lines = [];
  const width = mobile.matches ? 5 : 8;
  for (let i=0;i<b.length;i+=width) {
    const slice = Array.from(b.slice(i,i+width));
    const ascii = n => n < 32 || n > 126 ? '.' : n === 38 ? '&amp;' : n === 60 ? '&lt;' : n === 62 ? '&gt;' : String.fromCharCode(n);
    lines.push(`<div class="dump-line"><span class="offset">${hex(i,4)}</span><span>${slice.map((n,j)=>`<span class="byte" data-byte="${i+j}">${hex(n)}</span>`).join('')}</span><span class="ascii">${slice.map((n,j)=>`<span class="byte" data-byte="${i+j}">${ascii(n)}</span>`).join('')}</span></div>`);
  }
  $('dump').innerHTML = lines.join('');
  $('fields').scrollTop = 0; $('dump').scrollTop = 0; highlight(null);
}

function setView(next,focus=false,packet=index) {
  if (view !== 'packet' && next === 'packet') pause();
  view = next;
  $('canvas').hidden = $('legend').hidden = next !== 'network';
  $('sequence').hidden = next !== 'sequence';
  $('packet-view').hidden = next !== 'packet';
  for (const name of ['network','sequence','packet']) $(`show-${name}`).setAttribute('aria-pressed',next === name);
  if (next === 'packet') { inspected = packet; renderBytes(); }
  else { renderTrace(); paint(); }
  if (focus) $(`show-${next}`).focus();
}

$('filters').onclick = e => { if (e.target.dataset.category !== undefined) { category = Number(e.target.dataset.category); renderCatalog(); } };
$('osi').onclick = e => { if (e.target.dataset.layer) { const value = Number(e.target.dataset.layer); layer = layer === value ? 0 : value; renderCatalog(); } };
$('search').oninput = renderCatalog;
$('search').onkeydown = e => { if (e.key === 'Enter' && mobile.matches && !$('drawer').open) $('drawer').showModal(); };
$('dns-course').onclick = () => { expanded = !expanded; renderCatalog(); };
$('steps').onclick = e => {
  const button = e.target.closest('[data-step]'); if (!button) return;
  if (view === 'packet') setView('network');
  jump(stepStarts[Number(button.dataset.step)],true);
  if ($('drawer').open) $('drawer').close();
};
$('rows').onclick = e => { const row = e.target.closest('[data-index]'); if (row) jump(Number(row.dataset.index)); };
$('show-network').onclick = () => setView('network');
$('show-sequence').onclick = () => setView('sequence');
$('show-packet').onclick = () => setView('packet');
$('packet').onclick = () => setView('packet',true);
$('packet').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('packet',true); } };
function inspectSequence(e) {
  const row = e.target.closest('[data-seq]');
  if (!row) return;
  e.preventDefault();
  setView('packet',true,Number(row.dataset.seq));
}
$('sequence').onclick = inspectSequence;
$('sequence').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') inspectSequence(e); };
$('layers').onclick = e => {
  const i = e.target.closest('[data-group]')?.dataset.group; if (i === undefined) return;
  const group = $(`group-${i}`);
  $('fields').scrollTop += group.getBoundingClientRect().top-$('fields').getBoundingClientRect().top;
  const first = group.querySelector('.field');
  first.focus({preventScroll:true});
  highlight(first);
};
$('fields').onpointerover = e => { const field = e.target.closest('.field'); if (field) highlight(field); };
$('fields').onpointerleave = () => highlight(document.activeElement.closest('.field'));
$('fields').onfocusin = e => highlight(e.target.closest('.field'));
$('fields').onfocusout = e => { if (!$('fields').contains(e.relatedTarget)) highlight(null); };
$('play').onclick = play;
$('prev').onclick = () => jump(index-1);
$('next').onclick = () => jump(index+1);
$('reset').onclick = reset;
$('layout').onclick = () => $('layout').setAttribute('aria-pressed',$('app').classList.toggle('wide'));
$('theme').onclick = () => {
  const root = document.documentElement;
  root.dataset.theme = (root.dataset.theme || root.dataset.base) === 'light' ? 'dark' : 'light';
};
$('open-catalog').onclick = () => $('drawer').showModal();
$('close-catalog').onclick = () => $('drawer').close();
function moveCatalog() {
  if ($('drawer').open) $('drawer').close();
  $(mobile.matches ? 'drawer' : 'side').append($('catalog'));
  drawSequence(); renderTrace();
  if (view === 'packet') renderBytes();
}
mobile.addEventListener('change',moveCatalog);
motion.addEventListener('change',paint);
new ResizeObserver(() => {
  if (view === 'network' && network.clientHeight) { aimCamera(!running); paint(); }
}).observe(network);
document.addEventListener('visibilitychange',() => { if (document.hidden && running) pause(); });
document.addEventListener('keydown',e => {
  if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || $('drawer').open || e.target.closest('input,select,textarea')) return;
  if (e.key === ' ' && !e.target.closest('button,[role=button]')) { e.preventDefault(); play(); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); jump(index+(e.key === 'ArrowLeft' ? -1 : 1)); }
});
moveCatalog(); renderCatalog(); render();

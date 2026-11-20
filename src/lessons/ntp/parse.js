import { ipText, Reader } from '../../lib/bytes/core.js';
import { ntpEpoch } from './frames.js';

// shortcut: only the 48-byte lesson header in NTP era 0; extend when captures include extensions or other eras.
export function parseNTP(bytes, offset = 0) {
  const r = new Reader(bytes, offset, 'NTP', 'dns');
  const millisecond = n => n ? `${(n * 1000 / 65536).toFixed(1)} ms` : '0';
  r.number('闰秒指示、版本、模式', 1, n => `${n >> 6}, ${n >> 3 & 7}, ${n & 7}`);
  r.number('层级', 1);
  r.number('轮询间隔', 1, n => `${2 ** (n << 24 >> 24)} s`);
  r.number('精度', 1, n => `2^${n << 24 >> 24} s`);
  r.number('根延迟', 4, n => millisecond(n | 0));
  r.number('根离散度', 4, millisecond);
  r.slice('参考 ID', 4, b => b.some(Boolean) ? ipText(b) : '0');
  for (const label of ['参考时间', '起始时间', '接收时间', '发送时间']) {
    r.slice(label, 8, b => {
      const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const seconds = view.getUint32(0), fraction = view.getUint32(4);
      if (!seconds && !fraction) return '0';
      const micros = Math.round(fraction * 1e6 / 2 ** 32);
      const time = new Date((seconds - ntpEpoch + Math.floor(micros / 1e6)) * 1000).toISOString();
      return `${time.slice(11, 19)}.${String(micros % 1e6).padStart(6, '0')} UTC`;
    });
  }
  r.end();
  return r.layer();
}

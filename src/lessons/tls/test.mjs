import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('TLS 1.3 解析明文 Hello，并保持后续握手与应用数据不透明', () => {
  const frames = lesson.frames.map(inspectFrame);
  const values = (i, label) => frames[i].layers.at(-1).fields.filter(field => field.label === label).map(field => field.value);
  assert.deepEqual(lesson.steps.map(step => step.frames.length), [4, 1, 2, 1, 3, 3]);
  assert.deepEqual(lesson.frames.map(frame => frame.bytes.length), [66, 66, 54, 1904, 1514, 1514, 1084, 118, 741, 532, 12764, 78, 54, 54]);
  assert.deepEqual(values(3, 'legacy_record_version'), ['0x0301']);
  assert.deepEqual(values(3, '记录长度'), ['1845 B']);
  assert.deepEqual(values(3, '握手长度'), ['1841 B']);
  assert.deepEqual(values(3, '服务器名称'), ['www.example.com']);
  assert.deepEqual(values(3, '支持版本'), ['0x0304', '0x0303']);
  assert.deepEqual(values(3, '公钥长度'), ['1216 B', '32 B']);
  assert.deepEqual(values(4, '握手长度'), ['1206 B']);
  assert.deepEqual(values(4, '选中版本'), ['0x0304']);
  assert.deepEqual(values(4, '公钥长度'), ['1120 B']);
  assert.deepEqual(values(4, '记录类型'), ['Handshake', 'ChangeCipherSpec', 'Application Data']);
  assert.deepEqual(values(5, '握手类型'), []);
  assert.deepEqual(values(5, '密文（含认证数据）'), ['1455 B']);
  assert.deepEqual(values(9, '密文（含认证数据）'), ['234 B', '234 B']);
  assert.deepEqual(values(11, '密文（含认证数据）'), ['19 B']);
});

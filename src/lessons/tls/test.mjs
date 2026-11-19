import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFrame, reassembleTCP } from '../../lib/bytes/index.js';
import lesson from './index.js';

test('TLS 1.3 解析明文 Hello，并保持后续握手与应用数据不透明', () => {
  const frames = new Map(lesson.frames.map(frame => [frame.id, { ...frame, ...inspectFrame({ ...frame, fieldNames: lesson.fieldNames }) }]));
  const [hello, server, response] = lesson.reassembly.map(group => reassembleTCP(group.frames.map(id => frames.get(id)), 'tls', lesson.fieldNames));
  const values = ({ layers }, label) => layers.at(-1).fields.filter(field => field.label === label).map(field => field.value);
  assert.deepEqual(lesson.steps.map(step => step.frames.length), [5, 1, 2, 1, 11, 3]);
  assert.deepEqual(lesson.frames.map(frame => frame.bytes.length), [66, 66, 60, 1514, 444, 1514, 1514, 1084, 118, 741, 532, ...Array(8).fill(1514), 1084, 78, 60, 60]);
  assert.deepEqual(values(hello, 'legacy_record_version'), ['0x0301']);
  assert.deepEqual(values(hello, '记录长度'), ['1845 B']);
  assert.deepEqual(values(hello, '握手长度'), ['1841 B']);
  assert.deepEqual(values(hello, '服务器名称（SNI）'), ['www.example.com']);
  assert.deepEqual(values(hello, '提供的版本'), ['0x0304', '0x0303']);
  assert.deepEqual(values(hello, '密钥共享长度'), ['1216 B', '32 B']);
  assert.deepEqual(values(server, '握手长度'), ['1206 B']);
  assert.deepEqual(values(server, '商定的版本'), ['0x0304']);
  assert.deepEqual(values(server, '密钥共享长度'), ['1120 B']);
  assert.deepEqual(values(server, '记录类型'), ['Handshake', 'ChangeCipherSpec', 'Application Data']);
  assert.deepEqual(values(server, '密文（含认证数据）'), ['2724 B']);
  assert.deepEqual(values(response, '密文（含认证数据）'), ['12705 B']);
  assert.deepEqual(values(frames.get('tls-10'), '密文（含认证数据）'), ['234 B', '234 B']);
  assert.deepEqual(values(frames.get('tls-12'), '密文（含认证数据）'), ['19 B']);
});

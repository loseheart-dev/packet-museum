import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectFrame } from '../../lib/bytes/index.js';
import lesson from './index.js';

const layers = n => inspectFrame(lesson.frames[n - 1]).layers;

test('SIP relay rewrites the SDP offer and answer but preserves the RTP streams', () => {
  assert.deepEqual([5, 7, 10, 11].map(n => {
    const [sip, sdp] = layers(n).slice(-2);
    const field = (layer, key) => layer.fields.find(({ label }) => label.startsWith(key)).value;
    assert.equal(Number(field(sip, 'Content-Length')), sdp.length);
    return [field(sdp, 'c='), field(sdp, 'm=')];
  }), [
    ['IN IP4 192.168.1.10', 'audio 49170 RTP/AVP 0 101'], ['IN IP4 203.0.113.50', 'audio 40002 RTP/AVP 0 101'],
    ['IN IP4 192.168.0.23', 'audio 49172 RTP/AVP 0 101'], ['IN IP4 203.0.113.50', 'audio 40000 RTP/AVP 0 101'],
  ]);
  assert.deepEqual([14, 15, 16, 17].map(n => {
    const [udp, rtp] = layers(n).slice(-2);
    assert.equal(rtp.label, 'RTP');
    assert.equal(rtp.fields.at(-1).length, 160);
    return [...udp.fields.slice(0, 2), ...rtp.fields.slice(2, 4)].map(field => Number(field.value));
  }), [[49170, 40000, 11203, 54720], [40002, 49172, 11203, 54720],
    [49172, 40002, 30871, 913600], [40000, 49170, 30871, 913600]]);
});

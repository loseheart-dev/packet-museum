import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayback, lessonTimeline } from '../src/playback.js';

test('播放、暂停、抵达、越界定位、完成与重播', () => {
  const player = createPlayback([{ leadMs: 10, holdMs: 5 }, { leadMs: 10, holdMs: 5 }], [10, 15]);
  assert.equal(player.revealed(), 1);
  player.play();
  assert.equal(player.revealed(), -1);
  player.advance(15);
  assert.equal(player.revealed(), 0);
  assert.equal(player.progress(), .5);
  player.pause(); player.advance(100);
  assert.equal(player.state.elapsed, 15);
  player.play(); player.advance(10);
  assert.equal(player.state.index, 1);
  assert.equal(player.revealed(), 0);
  player.advance(100);
  assert(player.state.finished && !player.state.running);
  player.play();
  assert.equal(player.state.index, 0);
  assert(!player.state.finished && player.state.running);
  player.jump(99);
  assert.equal(player.state.index, 1);
  assert.equal(player.progress(), 1);
  player.jump(-99, true);
  assert.equal(player.state.index, 0);
  assert.equal(player.progress(), 0);
  player.reset();
  assert.equal(player.revealed(), 1);
});

test('无包开场与尾声、错峰并发和纯步骤定位', () => {
  const steps = [{ holdMs: 100 }, { frames: ['a', 'b', 'c'], parallel: [['a', 'b']] }, { events: [{ atMs: 50 }] }];
  const packets = [{ id: 'a', leadMs: 10, holdMs: 5 }, { id: 'b', leadMs: 15, holdMs: 5 }, { id: 'c', leadMs: 10, holdMs: 5 }];
  const { units, packetUnits, stepStarts, stepElapsed } = lessonTimeline(steps, packets, [25, 40, 25]);
  assert.deepEqual(units.map(unit => unit.members), [[], [0, 1], [2], []]);
  assert.deepEqual([packetUnits, stepStarts, stepElapsed], [[1, 1, 2], [0, 1, 3], [0, 0, 60, 0]]);
  const player = createPlayback(units);
  player.play(); player.advance(100);
  assert.equal(player.state.index, 1);
  player.advance(100);
  assert.equal(player.state.index, 3);
  assert.equal(player.progress(), 1);
  player.advance(2200);
  assert(player.state.finished);
  player.jump(0);
  assert.equal(player.state.index, 0);
});

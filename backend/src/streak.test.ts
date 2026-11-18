import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streakOf } from './streak.ts';

const TODAY = '2026-11-18';

test('no activity: no streak', () => {
  assert.deepEqual(streakOf([], TODAY), { current: 0, best: 0, lastDay: null });
});

test('active only today: 1', () => {
  assert.deepEqual(streakOf([TODAY], TODAY), { current: 1, best: 1, lastDay: TODAY });
});

test('three days in a row up to today, any order, repeats ignored', () => {
  const days = ['2026-11-17', TODAY, '2026-11-16', TODAY];
  assert.deepEqual(streakOf(days, TODAY), { current: 3, best: 3, lastDay: TODAY });
});

test('last active yesterday: streak still shown, can be continued today', () => {
  assert.deepEqual(streakOf(['2026-11-16', '2026-11-17'], TODAY), {
    current: 2,
    best: 2,
    lastDay: '2026-11-17',
  });
});

test('a whole day missed: current drops to 0, best stays', () => {
  assert.deepEqual(streakOf(['2026-11-15', '2026-11-16'], TODAY), {
    current: 0,
    best: 2,
    lastDay: '2026-11-16',
  });
});

test('a gap restarts the run; best remembers the longer one', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-17', TODAY];
  assert.deepEqual(streakOf(days, TODAY), { current: 2, best: 4, lastDay: TODAY });
});

test('runs continue across month and year ends', () => {
  assert.equal(streakOf(['2026-10-31', '2026-11-01'], '2026-11-01').current, 2);
  assert.equal(streakOf(['2026-12-31', '2027-01-01'], '2027-01-01').current, 2);
});

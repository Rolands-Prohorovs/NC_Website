// Test vectors from API.md "Daily offer algorithm". If one of these fails, the backend would
// offer different tasks than the frontend does today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash32, pickDaily, type DailyDef } from '../../src/lib/daily.ts';

const pool: DailyDef[] = [
  ...['e1', 'e2', 'e3', 'e4', 'e5'].map((id) => ({ id, tier: 'easy' as const })),
  ...['m1', 'm2', 'm3', 'm4'].map((id) => ({ id, tier: 'medium' as const })),
  ...['h1', 'h2', 'h3'].map((id) => ({ id, tier: 'hard' as const })),
];

const ids = (perDay: [number, number, number], date: string) =>
  pickDaily(pool, { easy: perDay[0], medium: perDay[1], hard: perDay[2] }, 'lahti', date)
    .map((task) => task.id)
    .join(' ');

test('hash32 matches API.md', () => {
  assert.equal(hash32(''), 2166136261);
  assert.equal(hash32('a'), 3826002220);
  assert.equal(hash32('lahti:easy:4154'), 3937242945);
});

test('offer with perDay 1 / 1 / 1 matches API.md', () => {
  assert.equal(ids([1, 1, 1], '2026-11-19'), 'e4 m2 h2');
  assert.equal(ids([1, 1, 1], '2026-11-20'), 'e2 m1 h1');
  assert.equal(ids([1, 1, 1], '2026-11-21'), 'e5 m3 h3');
  assert.equal(ids([1, 1, 1], '2027-01-01'), 'e4 m4 h2');
});

test('offer with perDay 2 / 1 / 0 matches API.md', () => {
  assert.equal(ids([2, 1, 0], '2026-11-19'), 'e5 e4 m2');
  assert.equal(ids([2, 1, 0], '2026-11-20'), 'e3 e1 m1');
  assert.equal(ids([2, 1, 0], '2026-11-21'), 'e2 e3 m3');
  assert.equal(ids([2, 1, 0], '2027-01-01'), 'e2 e3 m4');
});

test('the order of the pool in the file does not matter', () => {
  const reversed = [...pool].reverse();
  const quota = { easy: 1, medium: 1, hard: 1 };
  assert.deepEqual(
    pickDaily(reversed, quota, 'lahti', '2026-11-19'),
    pickDaily(pool, quota, 'lahti', '2026-11-19')
  );
});

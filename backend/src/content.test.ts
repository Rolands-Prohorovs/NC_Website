import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dailyOffer, loadCities, todayInHelsinki } from './content.ts';

const CONTENT_DIR = fileURLToPath(new URL('../../src/content/', import.meta.url));

test('reads the real Lahti content', async () => {
  const lahti = (await loadCities(CONTENT_DIR)).get('lahti');
  assert.ok(lahti, 'lahti is loaded');
  assert.equal(lahti.todo.size, 8);
  assert.equal(lahti.todo.get('dvv'), 25);
  assert.deepEqual(lahti.dailyXp, { easy: 5, medium: 10, hard: 15 });

  const offer = dailyOffer(lahti, '2026-11-19');
  assert.deepEqual(
    offer.map((task) => [task.tier, task.xp]),
    [['easy', 5], ['medium', 10], ['hard', 15]]
  );
  for (const task of offer) assert.ok(lahti.pool.has(task.id));
});

test('the day is counted in Helsinki time', () => {
  // November: UTC+2. 22:30 UTC is already 00:30 the next day in Finland.
  assert.equal(todayInHelsinki(new Date('2026-11-18T21:59:00Z')), '2026-11-18');
  assert.equal(todayInHelsinki(new Date('2026-11-18T22:30:00Z')), '2026-11-19');
  // Summer: UTC+3.
  assert.equal(todayInHelsinki(new Date('2026-06-30T20:59:00Z')), '2026-06-30');
  assert.equal(todayInHelsinki(new Date('2026-06-30T21:30:00Z')), '2026-07-01');
});

// A content folder with one city whose files we can break on purpose.
async function cityWith(city: unknown, daily: unknown): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nc-content-'));
  await mkdir(path.join(dir, 'testcity'));
  if (city !== undefined) {
    await writeFile(path.join(dir, 'testcity', 'city.json'), JSON.stringify(city));
  }
  await writeFile(path.join(dir, 'testcity', 'daily.json'), JSON.stringify(daily));
  return dir;
}

const goodCity = {
  tasks: [{ id: 'sim', xp: 10 }],
  daily: { xp: { easy: 5, medium: 10, hard: 15 }, perDay: { easy: 1, medium: 1, hard: 1 } },
};
const goodDaily = { tasks: [{ id: 'walk', tier: 'easy' }] };

const broken: [string, unknown, unknown, RegExp][] = [
  ['missing city.json', undefined, goodDaily, /city\.json: file is missing/],
  ['to-do task without xp', { ...goodCity, tasks: [{ id: 'sim' }] }, goodDaily, /"xp" is missing/],
  ['negative xp', { ...goodCity, tasks: [{ id: 'sim', xp: -5 }] }, goodDaily, /whole number/],
  ['same to-do id twice', { ...goodCity, tasks: [{ id: 'sim', xp: 1 }, { id: 'sim', xp: 2 }] }, goodDaily, /appears twice/],
  ['unknown tier', goodCity, { tasks: [{ id: 'walk', tier: 'extreme' }] }, /tier of "walk"/],
  ['bad daily id', goodCity, { tasks: [{ id: 'Walk Now', tier: 'easy' }] }, /must be a-z 0-9 -/],
];

for (const [name, city, daily, error] of broken) {
  test(`refuses to start on broken content: ${name}`, async () => {
    const dir = await cityWith(city, daily);
    try {
      await assert.rejects(loadCities(dir), error);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

test('good test content loads', async () => {
  const dir = await cityWith(goodCity, goodDaily);
  try {
    const city = (await loadCities(dir)).get('testcity');
    assert.equal(city?.todo.get('sim'), 10);
    assert.equal(dailyOffer(city!, '2026-11-19').map((t) => t.id).join(' '), 'walk');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

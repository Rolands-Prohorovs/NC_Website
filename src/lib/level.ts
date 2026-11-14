// Levels: every XP_PER_LEVEL points is one level. Shared by the Progress and Home pages.
// TODO (API.md Q7): the backend will send `level`; until then the frontend derives it from XP.

export const XP_PER_LEVEL = 100;

export type Level = {
  /** 1 at 0 XP. */
  level: number;
  /** XP still missing for the next level. */
  toNext: number;
  /** How far into the current level, 0 to 100 (for the meter). */
  pct: number;
};

export function levelOf(xp: number): Level {
  const into = xp % XP_PER_LEVEL;
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    toNext: XP_PER_LEVEL - into,
    pct: (into / XP_PER_LEVEL) * 100,
  };
}

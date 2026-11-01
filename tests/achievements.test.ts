import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAchievements,
  nextAchievement,
  type AchievementTaskInput,
} from '../src/shared/achievements.ts';

function task(overrides: Partial<AchievementTaskInput>): AchievementTaskInput {
  return {
    status: 'Not Started',
    level: 'N/A',
    category_seed_key: 'part_a',
    due_date: null,
    completed_at: null,
    archived_at: null,
    subtask_done: 0,
    time_spent_minutes: 0,
    ...overrides,
  };
}

const done = (at: string, o: Partial<AchievementTaskInput> = {}) =>
  task({ status: 'Completed', completed_at: at, ...o });

const byId = (list: ReturnType<typeof computeAchievements>, id: string) => {
  const found = list.find((a) => a.id === id);
  assert.ok(found, id);
  return found;
};

test('no records: nothing earned, group badges need a non-empty group', () => {
  const list = computeAchievements([], null);
  assert.equal(list.filter((a) => a.earned).length, 0);
  assert.equal(byId(list, 'part_b').target, 0);
  assert.equal(byId(list, 'part_b').earned, false);
});

test('Part B badge: earned only when every non-archived Part B record is done', () => {
  const partB = [
    done('2026-09-01T00:00:00.000Z', { category_seed_key: 'part_b' }),
    done('2026-09-03T00:00:00.000Z', { category_seed_key: 'part_b' }),
    task({ category_seed_key: 'part_b' }),
  ];
  let b = byId(computeAchievements(partB, null), 'part_b');
  assert.equal(b.earned, false);
  assert.equal(b.current, 2);
  assert.equal(b.target, 3);

  // Archiving the unfinished record removes it from the group.
  partB[2] = task({ category_seed_key: 'part_b', archived_at: '2026-09-04T00:00:00.000Z' });
  b = byId(computeAchievements(partB, null), 'part_b');
  assert.equal(b.earned, true);
  assert.equal(b.earned_at, '2026-09-03T00:00:00.000Z');
});

test('count badges, level badges, SWAYAM and Semester Star', () => {
  const tasks = [
    done('2026-08-01T00:00:00.000Z', { level: 'Level I', subtask_done: 10, time_spent_minutes: 300 }),
    done('2026-08-05T00:00:00.000Z', { level: 'Level I', subtask_done: 15, due_date: '2026-08-04' }),
    done('2026-08-09T00:00:00.000Z', { level: 'Level II', time_spent_minutes: 300 }),
    task({ level: 'Level II' }),
  ];
  const list = computeAchievements(tasks, 'Completed');
  assert.equal(byId(list, 'first_record').earned_at, '2026-08-01T00:00:00.000Z');
  assert.equal(byId(list, 'five_records').earned, false);
  assert.equal(byId(list, 'five_records').current, 3);
  assert.equal(byId(list, 'halfway').earned, true);
  assert.equal(byId(list, 'halfway').earned_at, '2026-08-05T00:00:00.000Z');
  assert.equal(byId(list, 'level_1').earned, true);
  assert.equal(byId(list, 'level_2').earned, false);
  assert.equal(byId(list, 'swayam').earned, true);
  assert.equal(byId(list, 'steps_25').earned, true);
  assert.equal(byId(list, 'focused').earned, true);
  assert.equal(byId(list, 'planner').current, 1);
  assert.equal(byId(list, 'semester_star').earned, false);

  const all = tasks.map((t) =>
    t.status === 'Completed'
      ? t
      : { ...t, status: 'Completed' as const, completed_at: '2026-08-20T00:00:00.000Z' }
  );
  assert.equal(byId(computeAchievements(all, 'Completed'), 'semester_star').earned, true);
  assert.equal(byId(computeAchievements(all, 'In Progress'), 'semester_star').earned, false);
});

test('nextAchievement picks the unearned badge with the most progress', () => {
  const list = computeAchievements(
    [done('2026-08-01T00:00:00.000Z'), done('2026-08-02T00:00:00.000Z'), task({}), task({})],
    null
  );
  const next = nextAchievement(list);
  assert.ok(next);
  assert.equal(next.earned, false);
  assert.notEqual(next.id, 'semester_star');
  for (const a of list.filter((x) => !x.earned && x.target > 0 && x.id !== 'semester_star')) {
    assert.ok(next.current / next.target >= a.current / a.target);
  }
});

test('nextAchievement suggests Semester Star only when it is the last badge left', () => {
  const list = computeAchievements([done('2026-08-01T00:00:00.000Z')], null).map((a) =>
    a.id === 'semester_star' ? a : { ...a, earned: true }
  );
  assert.equal(nextAchievement(list)?.id, 'semester_star');
  assert.equal(nextAchievement(list.map((a) => ({ ...a, earned: true }))), null);
});

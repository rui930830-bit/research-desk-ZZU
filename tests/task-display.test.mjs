import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOverdue, matchesTaskOrigin } from '../lib/task-display.ts';
test('completed tasks never become overdue as time advances; reopened tasks use their deadline', () => {
  assert.equal(isOverdue('2026-09-07', true, '2026-09-08'), false);
  assert.equal(isOverdue('2026-09-07', true, '2027-01-01'), false);
  assert.equal(isOverdue('2026-09-07', false, '2026-09-08'), true);
  assert.equal(isOverdue('2026-09-08', false, '2026-09-08'), false);
  assert.equal(isOverdue(undefined, false, '2026-09-08'), false);
});
test('temporary tasks retain their schedule and completion and old records remain visible', () => {
  const records = [
    { id: 'old', bucket: '今天' },
    { id: 'temp', bucket: '今天', isTemporary: true },
    { id: 'done', done: true, isTemporary: true },
  ];
  const original = structuredClone(records);
  assert.deepEqual(
    records.filter((t) => matchesTaskOrigin(t, '计划')).map((t) => t.id),
    ['old'],
  );
  assert.deepEqual(
    records.filter((t) => matchesTaskOrigin(t, '临时')).map((t) => t.id),
    ['temp', 'done'],
  );
  assert.equal(records.filter((t) => matchesTaskOrigin(t, '全部')).length, 3);
  assert.deepEqual(records, original);
});

import { progress } from '../lib/desk.ts';
test('project deadline follows weighted completion, including reopened stages', () => {
  const project = {
    id: 'p',
    title: '项目',
    stages: [
      { weight: 1, done: true },
      { weight: 3, done: true },
    ],
  };
  assert.equal(
    isOverdue('2026-09-07', progress(project) >= 100, '2026-09-08'),
    false,
  );
  project.stages[1].done = false;
  assert.equal(
    isOverdue('2026-09-07', progress(project) >= 100, '2026-09-08'),
    true,
  );
  assert.equal(
    isOverdue('2026-09-08', progress(project) >= 100, '2026-09-08'),
    false,
  );
});
test('completed meetings keep dates without overdue; pending meetings remain overdue', () => {
  for (const completed of [true, false]) {
    assert.equal(isOverdue('2026-09-01', completed, '2026-09-08'), !completed);
  }
});

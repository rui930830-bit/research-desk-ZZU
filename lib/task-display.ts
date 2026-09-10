export function isOverdue(
  date: string | undefined,
  completed: boolean,
  today: string,
) {
  return !!date && !completed && date < today;
}
export function matchesTaskOrigin(
  task: { isTemporary?: boolean },
  origin: string,
) {
  return origin === '临时'
    ? task.isTemporary === true
    : origin === '计划'
      ? !task.isTemporary
      : true;
}

export type Stage = {
  id: string;
  title: string;
  weight: number;
  done: boolean;
  start?: string;
  end?: string;
};
export const dateDay = (date: string) =>
  Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
export const dayDate = (day: number) =>
  new Date(day * 86400000).toISOString().slice(0, 10);
export const stageEnd = (stage: Stage, now: string) =>
  stage.end === 'present' ? now : stage.end || '';
export const finishStage = (
  stage: Stage,
  done: boolean,
  now: string,
): Stage => ({
  ...stage,
  done,
  end: done && stage.end === 'present' ? now : stage.end,
});
export function ganttRange(stages: Stage[], deadline: string, now: string) {
  const dates = stages
    .flatMap((s) =>
      s.start && s.end ? [dateDay(s.start), dateDay(stageEnd(s, now))] : [],
    )
    .filter(Number.isFinite);
  if (deadline && Number.isFinite(dateDay(deadline)))
    dates.push(dateDay(deadline));
  const first = dates.length ? Math.min(...dates) : dateDay(now);
  const last = dates.length ? Math.max(...dates) : first + 27;
  return { start: first - 3, end: Math.max(last + 4, first + 27) };
}

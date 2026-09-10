/** Reorder only visible slots. Hidden records retain position and all fields. */
export function reorderVisible<T extends { id: string }>(
  all: T[],
  visibleIds: string[],
  source: string,
  target: string,
): T[] {
  const ids = new Set(visibleIds);
  if (ids.size !== visibleIds.length || !ids.has(source) || !ids.has(target))
    throw new Error('排序范围已变化，请重试');
  const visible = all.filter((x) => ids.has(x.id));
  if (visible.length !== ids.size) throw new Error('记录已变化，请刷新后重试');
  if (source === target) return all;
  const from = visible.findIndex((x) => x.id === source),
    to = visible.findIndex((x) => x.id === target);
  const [moved] = visible.splice(from, 1);
  visible.splice(to, 0, moved);
  let index = 0;
  return all.map((x) => (ids.has(x.id) ? visible[index++] : x));
}

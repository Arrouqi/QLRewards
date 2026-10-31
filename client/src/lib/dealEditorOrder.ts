/** Reindex editor state by the same permutation as the deal cards. */
export function moveDealIndex(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (to < from && index >= to && index < from) return index + 1;
  return index;
}

export function moveDealState<T>(state: Record<number, T>, from: number, to: number): Record<number, T> {
  return Object.fromEntries(Object.entries(state).map(([index, value]) => [
    moveDealIndex(Number(index), from, to), value,
  ]));
}

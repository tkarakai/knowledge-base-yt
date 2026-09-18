export interface DiffLine {
  kind: "same" | "removed" | "added";
  text: string;
}

/** Bounded line diff; large documents use a readable prefix/suffix comparison. */
export function markdownDiff(before: string, after: string): DiffLine[] {
  const left = before ? before.split("\n") : [];
  const right = after ? after.split("\n") : [];
  if (left.length * right.length > 250_000) {
    let start = 0;
    while (
      start < left.length &&
      start < right.length &&
      left[start] === right[start]
    )
      start++;
    let end = 0;
    while (
      end < left.length - start &&
      end < right.length - start &&
      left[left.length - 1 - end] === right[right.length - 1 - end]
    )
      end++;
    return [
      ...left.slice(0, start).map((text) => ({ kind: "same" as const, text })),
      ...left
        .slice(start, left.length - end)
        .map((text) => ({ kind: "removed" as const, text })),
      ...right
        .slice(start, right.length - end)
        .map((text) => ({ kind: "added" as const, text })),
      ...left
        .slice(left.length - end)
        .map((text) => ({ kind: "same" as const, text })),
    ];
  }
  const matrix = Array.from(
    { length: left.length + 1 },
    () => new Uint32Array(right.length + 1),
  );
  for (let i = left.length - 1; i >= 0; i--)
    for (let j = right.length - 1; j >= 0; j--)
      matrix[i][j] =
        left[i] === right[j]
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      result.push({ kind: "same", text: left[i++] });
      j++;
    } else if (
      i < left.length &&
      (j >= right.length || matrix[i + 1][j] >= matrix[i][j + 1])
    )
      result.push({ kind: "removed", text: left[i++] });
    else result.push({ kind: "added", text: right[j++] });
  }
  return result;
}

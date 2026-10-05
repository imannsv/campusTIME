// Independent overlap groups keep their own widths. A busy afternoon must not
// make a single morning event narrower.
export function layoutEvents<T extends Record<string, any>>(events: T[]) {
  const sorted = [...events].sort(
    (a, b) =>
      Date.parse(a.start) - Date.parse(b.start) ||
      Date.parse(b.end) - Date.parse(a.end),
  );
  const result: { row: T; lane: number; lanes: number; span: number }[] = [];
  let group: T[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const ends: number[] = [];
    const placed = group.map((row) => {
      const start = Date.parse(row.start);
      let lane = ends.findIndex((end) => end <= start);
      if (lane < 0) lane = ends.length;
      ends[lane] = Date.parse(row.end);
      return { row, lane, lanes: 0, span: 1 };
    });
    for (const item of placed) {
      item.lanes = ends.length;
      for (let next = item.lane + 1; next < item.lanes; next++) {
        if (
          placed.some(
            (other) =>
              other.lane === next &&
              Date.parse(other.row.start) < Date.parse(item.row.end) &&
              Date.parse(other.row.end) > Date.parse(item.row.start),
          )
        )
          break;
        item.span++;
      }
    }
    result.push(...placed);
    group = [];
  };
  for (const row of sorted) {
    if (Date.parse(row.start) >= groupEnd) flush();
    group.push(row);
    groupEnd = Math.max(
      group.length === 1 ? -Infinity : groupEnd,
      Date.parse(row.end),
    );
  }
  flush();
  return result;
}

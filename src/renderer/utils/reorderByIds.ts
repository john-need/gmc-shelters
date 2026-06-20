/**
 * Returns a new id list with `activeId` moved to the position of `overId`,
 * matching dnd-kit's arrayMove semantics. Returns the input order unchanged when
 * the ids are equal or either id is absent.
 */
export function reorderByIds(ids: number[], activeId: number, overId: number): number[] {
  if (activeId === overId) return ids;
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

import { reorderByIds } from './reorderByIds';

describe('reorderByIds', () => {
  it('moves the active id to the over id position', () => {
    expect(reorderByIds([1, 2, 3], 3, 1)).toEqual([3, 1, 2]);
  });

  it('returns the same order when active and over are equal', () => {
    expect(reorderByIds([1, 2, 3], 2, 2)).toEqual([1, 2, 3]);
  });

  it('returns the same order when an id is absent', () => {
    expect(reorderByIds([1, 2, 3], 9, 1)).toEqual([1, 2, 3]);
  });
});

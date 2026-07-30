import Database from 'better-sqlite3';
import { getAllBuilders } from './builders';

jest.mock('./connection');
import { getDb } from './connection';

const SCHEMA = `
  CREATE TABLE builders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'organization',
    notes       TEXT NOT NULL DEFAULT '',
    created     TEXT NOT NULL DEFAULT '',
    updated     TEXT NOT NULL DEFAULT ''
  );
`;

describe('getAllBuilders', () => {
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
    (getDb as jest.Mock).mockReturnValue(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns every builders row, ordered by name', () => {
    db.prepare(
      `INSERT INTO builders (id, name, type, notes, created, updated)
       VALUES (1, 'Green Mountain Club', 'organization', '', '2020-01-01', '2020-01-02')`,
    ).run();
    db.prepare(
      `INSERT INTO builders (id, name, type, notes, created, updated)
       VALUES (2, 'Ansel Guyette', 'individual', '', '2020-01-01', '2020-01-02')`,
    ).run();

    const result = getAllBuilders();

    expect(result).toEqual([
      { id: 2, name: 'Ansel Guyette', type: 'individual', notes: '', created: '2020-01-01', updated: '2020-01-02' },
      { id: 1, name: 'Green Mountain Club', type: 'organization', notes: '', created: '2020-01-01', updated: '2020-01-02' },
    ]);
  });

  it('returns an empty array when there are no builders', () => {
    expect(getAllBuilders()).toEqual([]);
  });
});

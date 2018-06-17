import { ColumnMap } from './columnMap'

const rows: ReadonlyArray<any> = [
  { line: 't800', type: 'start', timestamp: 1000 },
  { line: 't800', type: 'pause', timestamp: 2000, reason: 'machine on fire' },
  { line: 't800', type: 'resume', timestamp: 3000 },
  { line: 't800', type: 'pause', timestamp: 4000, reason: 'coffee break' },
  { line: 't800', type: 'resume', timestamp: 5000 },
  { line: 't800', type: 'stop', timestamp: 6000, produced: 1000 },
]

const cols = {
  children: {
    line: {
      s: [[0, 1, 2, 3, 4, 5], ['t800', 't800', 't800', 't800', 't800', 't800']],
    },
    type: {
      s: [[0, 1, 2, 3, 4, 5], ['start', 'pause', 'resume', 'pause', 'resume', 'stop']],
    },
    timestamp: {
      s: [[0, 1, 2, 3, 4, 5], [1000, 2000, 3000, 4000, 5000, 6000]],
    },
    reason: {
      s: [[1, 3], ['machine on fire', 'coffee break']],
    },
    produced: {
      s: [[5], [1000]],
    },
  },
}

describe('ColumnMap', () => {
  it('should compress well', () => expect(ColumnMap.of(rows)).toEqual(cols))
})

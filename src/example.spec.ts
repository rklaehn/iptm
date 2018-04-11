import { ColumnMap } from './columnMap'

const rows: ReadonlyArray<any> = [
  { line: 't800', type: 'start', timestamp: 1000 },
  { line: 't800', type: 'pause', timestamp: 2000, reason: 'machine on fire' },
  { line: 't800', type: 'resume', timestamp: 3000 },
  { line: 't800', type: 'pause', timestamp: 4000, reason: 'coffee break' },
  { line: 't800', type: 'resume', timestamp: 5000 },
  { line: 't800', type: 'stop', timestamp: 6000, produced: 1000 },
]

const result: ColumnMap<any> = {
  children: {
    line: {
      indices: [0, 1, 2, 3, 4, 5],
      values: ['t800', 't800', 't800', 't800', 't800', 't800'],
    },
    type: {
      indices: [0, 1, 2, 3, 4, 5],
      values: ['start', 'pause', 'resume', 'pause', 'resume', 'stop'],
    },
    timestamp: {
      indices: [0, 1, 2, 3, 4, 5],
      values: [1000, 2000, 3000, 4000, 5000, 6000],
    },
    reason: {
      indices: [1, 3],
      values: ['machine on fire', 'coffee break'],
    },
    produced: {
      indices: [5],
      values: [1000],
    },
  },
}

describe('ColumnMap', () => {
  it('should compress well', () => {
    console.log(JSON.stringify(ColumnMap.of(rows)))
  })
})

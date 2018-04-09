// tslint:disable:readonly-array
import { fromColumnMap, toColumnMap } from './columnMap'

const roundtrip = <T>(rows: ReadonlyArray<T>): ReadonlyArray<T> => fromColumnMap(toColumnMap(rows))
describe('toColumnMap/fromColumnMap', () => {
  it('should work for normal time series data', () => {
    const rows = [{ x: 1, y: 2 }, { x: 2, y: 1 }]

    expect(toColumnMap(rows)).toMatchSnapshot()
    expect(roundtrip(rows)).toEqual(rows)
  })

  it('should properly deal with missing values', () => {
    const rows = [{ y: 2 }, { x: 2 }]

    expect(toColumnMap(rows)).toMatchSnapshot()
    expect(roundtrip(rows)).toEqual(rows)
  })

  it('should properly deal with nested objects', () => {
    const rows = [
      { type: 'start', data: { timestamp: 1 } },
      { type: 'stop', data: { reason: 'because' } },
    ]

    expect(toColumnMap(rows)).toMatchSnapshot()
    expect(roundtrip(rows)).toEqual(rows)
  })

  it('should properly deal with weird javascript crap', () => {
    const rows = [
      // unusual values as values
      {
        x: undefined,
        y: null,
        z: true,
        w: false,
        a: 1.0,
        b: NaN,
        c: Infinity,
        d: -Infinity,
      },
      // unusual values as keys
      { true: 1, false: 0, 1: 0, 0: 1, undefined: false, null: 1 },
    ]
    expect(toColumnMap(rows)).toMatchSnapshot()
    expect(roundtrip(rows)).toEqual(rows)
  })
})

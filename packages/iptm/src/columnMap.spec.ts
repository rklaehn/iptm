// tslint:disable:readonly-array no-expression-statement
import { ColumnMap, RA } from './columnMap'

const columnMapTest = (name: string, roundtrip: <T>(rows: RA<T>) => RA<T>) =>
  describe(name, () => {
    it('should work for normal time series data', () => {
      const rows = [{ x: 1, y: 2 }, { x: 2, y: 1 }]

      expect(ColumnMap.of(rows)).toMatchSnapshot()
      expect(roundtrip(rows)).toEqual(rows)
    })

    it('should properly deal with missing values', () => {
      const rows = [{ y: 2 }, { x: 2 }]

      expect(ColumnMap.of(rows)).toMatchSnapshot()
      expect(roundtrip(rows)).toEqual(rows)
    })

    it('should properly deal with nested objects', () => {
      const rows = [
        { type: 'start', data: { timestamp: 1 } },
        { type: 'stop', data: { reason: 'because' } },
      ]

      expect(ColumnMap.of(rows)).toMatchSnapshot()
      expect(roundtrip(rows)).toEqual(rows)
    })

    it.skip('should properly deal with nested arrays', () => {
      const rows = [['a', 'b', 'c'], ['a', 'c'], ['a']]

      expect(ColumnMap.of(rows)).toMatchSnapshot()
      // expect(roundtrip(rows)).toEqual(rows)
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
      expect(ColumnMap.of(rows)).toMatchSnapshot()
      expect(roundtrip(rows)).toEqual(rows)
    })

    it('should not support function values', () => {
      const rows = [
        {
          x: (x: string) => x,
        },
      ]
      expect(() => ColumnMap.of(rows)).toThrow()
    })

    it('should not allow converting invalid column maps to array', () => {
      const cols = {
        o: {
          line: {
            s: [[0, 1], ['t800']],
          },
        },
      }
      expect(() => ColumnMap.toArray(cols)).toThrow()
    })

    it('should support concatenation', () => {
      const rows = [{ x: 1, y: 2 }, { x: 2, y: 1 }]
      const a = ColumnMap.of(rows)
      const b = ColumnMap.of(rows)
      expect(ColumnMap.toArray(ColumnMap.concat(a, b))).toEqual(rows.concat(rows))
    })
  })

const fromToRoundtrip = <T>(rows: RA<T>): RA<T> => ColumnMap.toArray(ColumnMap.of(rows))

const iterableRoundtrip = <T>(rows: RA<T>): RA<T> => [
  ...ColumnMap.iterable<T>(ColumnMap.of<T>(rows)),
]

const builderRoundtrip = <T>(rows: RA<T>): RA<T> => {
  const builder = ColumnMap.builder()
  rows.forEach(builder.add)
  const cm = builder.build()
  return ColumnMap.toArray(cm)
}

columnMapTest('toColumnMap/fromColumnMap', fromToRoundtrip)
// columnMapTest('toColumnMap/iterable', iterableRoundtrip)
// columnMapTest('builder/fromColumnMap', builderRoundtrip)

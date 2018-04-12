// tslint:disable:no-if-statement no-object-mutation no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-delete no-let no-console
import * as seedrandom from 'seedrandom'
import { compressAllOptions, CompressResult, DagArray, fromDelta, toDelta } from './dagArray'

describe('toDelta/fromDelta', () => {
  const roundtrip = (xs: Array<number>) => fromDelta(xs[0], toDelta(xs))
  it('should fail on empty array', () => {
    expect(() => toDelta([])).toThrow()
  })

  it('should be reversible for any numeric array not containing NaN', () => {
    const xs = [1, 2, 3, 4]
    expect(roundtrip(xs)).toEqual(xs)
  })
})

const stripData = (r: ReadonlyArray<CompressResult>) => r.map(({ type, size }) => ({ type, size }))

describe('DagArray', () => {
  const smallArray = ['a', 'b', 'c']
  // deflate will even get some compression from random doubles,
  // so the array needs to be small
  const smallRandom = Array.from({ length: 9 }, () => Math.random())
  const compressibleStrings = Array.from({ length: 128 }, (_, x) => `number${x}`)
  const compressibleStringsSmall = Array.from({ length: 9 }, (_, x) => `number${x}`)
  const increasingSmallIntegers = Array.from({ length: 128 }, (_, x) => x)
  const roundtrip = (data: ReadonlyArray<any>): Promise<ReadonlyArray<any>> =>
    DagArray.compress(data).then(DagArray.decompress)
  describe('compress', () => {
    it('should not attempt to compress very small arrays', () =>
      expect(compressAllOptions(smallArray).then(_ => _.map(_ => _.type))).resolves.toEqual([
        'uncompressed',
      ]))

    it('should not compress if the data is random', () =>
      expect(
        compressAllOptions(smallRandom)
          .then(x => x.map(y => y.type))
          .then(x => x[0]),
      ).resolves.toEqual('uncompressed'))

    it('should compress if the data is strings that contain some redundancy', () =>
      expect(
        compressAllOptions(compressibleStrings)
          .then(_ => _.map(_ => _.type))
          .then(x => x[0]),
      ).resolves.toEqual('deflate'))

    it('should delta-compress if the data is numbers that are ascending', () =>
      expect(
        compressAllOptions(increasingSmallIntegers)
          .then(_ => _.map(_ => _.type))
          .then(x => x[0]),
      ).resolves.toEqual('delta-deflate'))

    it('example enum compression', () => {
      const sr = seedrandom('')
      const types = Array.from(
        { length: 1000 },
        (_, i) =>
          i === 0 ? 'start' : i === 1000 - 1 ? 'stop' : sr.double() > 0.5 ? 'pause' : 'resume',
      )
      console.log(types)
      console.log(JSON.stringify(types).length)
      return compressAllOptions(types)
        .then(stripData)
        .then(x => console.log(x))
    })

    it('example temperature data compression', () => {
      const sr = seedrandom('')
      const types = Array.from({ length: 1000 }, () => Math.floor(sr.double() * 100) / 500 + 293)
      console.log(types)
      console.log(JSON.stringify(types).length)
      return compressAllOptions(types)
        .then(stripData)
        .then(x => console.log(x))
    })

    it('should have better compression when using delta compression for linear sequences', () => {
      const rnd = seedrandom('x')
      const timestamps = Array.from(
        { length: 1000 },
        (_, i) => 1523567653397 + Math.floor(rnd() * 6) + i * 1000,
      )
      console.log(timestamps)
      console.log(JSON.stringify(timestamps).length)
      expect(
        compressAllOptions(timestamps).then(_ => _.map(({ size, type }) => ({ size, type }))),
      ).resolves.toEqual([
        { size: 821, type: 'delta-deflate' },
        { size: 3381, type: 'deflate' },
        { size: 5003, type: 'uncompressed' },
      ])
    })

    it('should not attempt non-delta compression if the forceDelta option is set', () =>
      expect(
        compressAllOptions(increasingSmallIntegers, { forceDelta: true }).then(_ =>
          _.map(_ => _.type),
        ),
      ).resolves.toEqual(['delta-deflate', 'uncompressed']))
  })

  describe('decompress', () => {
    it('should work for various cases', () => {
      const cases = [
        smallArray, // too small to be considered for compression
        smallRandom, // will not be compressed because it is not worth it
        compressibleStringsSmall, // small example that will be compressed
        compressibleStrings, // larger example
        increasingSmallIntegers, // will use delta compression
      ]
      return expect(Promise.all(cases.map(roundtrip))).resolves.toEqual(cases)
    })
  })
})

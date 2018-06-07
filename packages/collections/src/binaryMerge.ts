// tslint:disable no-class no-this no-if-statement no-bitwise no-expression-statement no-empty
export type index = number
export type cr = number

export abstract class BinaryMerge {
  protected abstract compare(ai: index, bi: index): cr
  protected collision(_ai: index, _bi: index): void {}
  protected fromA(_a0: index, _a1: index, _bi: index): void {}
  protected fromB(_ai: index, _b0: index, _b1: index): void {}
  protected merge0(a0: index, a1: index, b0: index, b1: index): void {
    if (a0 === a1) {
      if (b0 !== b1) {
        this.fromB(a0, b0, b1)
      }
    } else if (b0 === b1) {
      this.fromA(a0, a1, b0)
    } else {
      const am = (a0 + a1) / 2
      const res = this.binarySearchB(am, b0, b1)
      if (res >= 0) {
        // same elements
        const bm = res
        // merge everything below a(am) with everything below the found element
        this.merge0(a0, am, b0, bm)
        // add the elements a(am) and b(bm)
        this.collision(am, bm)
        // merge everything above a(am) with everything above the found element
        this.merge0(am + 1, a1, bm + 1, b1)
      } else {
        const bm = -res - 1
        // merge everything below a(am) with everything below the found insertion point
        this.merge0(a0, am, b0, bm)
        // add a(am)
        this.fromA(am, am + 1, bm)
        // everything above a(am) with everything above the found insertion point
        this.merge0(am + 1, a1, bm, b1)
      }
    }
  }
  private binarySearchB(ai: index, b0: index, b1: index): index {
    const binarySearch0 = (low: index, high: index): index => {
      if (low <= high) {
        const mid = (low + high) >>> 1
        const c = this.compare(ai, mid)
        return c > 0 ? binarySearch0(mid + 1, high) : c < 0 ? binarySearch0(low, mid - 1) : mid
      } else {
        return -(low + 1)
      }
    }
    return binarySearch0(b0, b1 - 1)
  }
}

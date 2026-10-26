/** Approximate geographic placement on a 5 by 6 grid (column, row). A cartogram, not a map:
 * no boundaries are drawn (DECISION D13). */
export const PLACE: Record<string, [number, number]> = {
  north_western: [2, 1],
  northern: [3, 2],
  north_east: [5, 2],
  gujarat: [1, 3],
  central: [2, 3],
  eastern: [4, 3],
  western: [2, 4],
  south_central: [3, 4],
  south_western: [2, 5],
  southern: [3, 5],
  kerala: [2, 6],
}
export const SHORT: Record<string, string> = {
  north_western: 'North-West',
  north_east: 'North-East',
  south_central: 'South-Central',
  south_western: 'South-West',
}

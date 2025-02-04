export const stringifyBigInt = (_: any, v: any) =>
  typeof v === 'bigint' ? v.toString() : v

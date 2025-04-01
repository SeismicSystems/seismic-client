import { http } from 'viem'

import { seismicDevnet2 } from '@sviem/chain.ts'
import { createShieldedPublicClient } from '@sviem/client.ts'

const client = createShieldedPublicClient({
  chain: seismicDevnet2,
  transport: http(),
})

// const trace = await client.request({
//   method: 'debug_traceTransaction',
//   params: [
//     '0x4a1d0376b1c03c9dd07e47608d8a0e5d593473a28573224ef5ae497dea77eca2',
//     {
//       tracer: 'muxTracer',
//       tracerConfig: {
//         callTracer: {},
//         '4byteTracer': null,
//         flatCallTracer: {},
//         prestateTracer: {},
//         noopTracer: null,
//       },
//     },
//   ],
// })
// console.log(trace)

const defaultTrace = await client.request({
  method: 'debug_traceTransaction',
  params: [
    '0x4a1d0376b1c03c9dd07e47608d8a0e5d593473a28573224ef5ae497dea77eca2',
    {
      tracer: 'default',
    },
  ],
})

// const opCounts = trace.structLogs.reduce(
//   (acc, { op }) => {
//     acc[op] = (acc[op] || 0) + 1
//     return acc
//   },
//   {} as Record<string, number>
// )

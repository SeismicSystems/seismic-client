import { seismicDevnet1, seismicDevnet2 } from 'seismic-viem'

import { checkAllFaucets } from '@sbot/faucetChecker'

const chains = [
  seismicDevnet1,
  seismicDevnet2,
  // createSeismicDevnet({ node: 3 }),
]
checkAllFaucets(chains)

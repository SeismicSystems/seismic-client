import { checkAllFaucets } from '@sbot/faucetChecker'
import { seismicDevnet1, seismicDevnet2, seismicDevnet3 } from '@sviem/chain'

const chains = [
  seismicDevnet1,
  seismicDevnet2,
  seismicDevnet3,
  // createSeismicDevnet({ node: 3 }),
]
checkAllFaucets(chains)

import { checkAllFaucets } from '@sbot/faucetChecker'
import { seismicDevnet1, seismicDevnet2 } from '@sviem/chain'

const chains = [
  seismicDevnet1,
  seismicDevnet2,
  // createSeismicDevnet({ node: 3 }),
]
checkAllFaucets(chains)

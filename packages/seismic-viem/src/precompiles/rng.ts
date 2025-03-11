import { Precompile } from '@sviem/precompiles/precompile'

export const RNG_ADDRESS = '0x64'
export const RNG_GAS = 3505n

export const rng: Precompile<[bigint]> = {
  address: RNG_ADDRESS,
  abi: [
    {
      name: 'rng',
      inputs: [{ type: 'uint32' }],
      outputs: [{ type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],
  gas: () => RNG_GAS,
  transformParams: (args) => args,
}

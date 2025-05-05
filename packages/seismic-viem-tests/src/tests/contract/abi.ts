import { Abi } from 'viem'

export const contractABI = [
  {
    type: 'function',
    name: 'increment',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isOdd',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setNumber',
    inputs: [{ name: 'newNumber', type: 'suint256', internalType: 'suint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const satisfies Abi

export const CONTRACT_BYTECODE =
  '0x6080604052348015600f57600080fd5b506101598061001f6000396000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c806324a7f0b714604157806343bd0d70146053578063d09de08a14606d575b600080fd5b6051604c366004609e565b6000b1565b005b60596073565b604051901515815260200160405180910390f35b6051608a565b600060026000b06082919060b6565b600114905090565b600080b0908060978360d7565b919050b150565b60006020828403121560af57600080fd5b5035919050565b60008260d257634e487b7160e01b600052601260045260246000fd5b500690565b60006001820160f657634e487b7160e01b600052601160045260246000fd5b506001019056fea26469706673582212206c8d0b6848aef0a4ceb33182854a75dcd854a9740ac84abe06feaaa63d3f96c164736f6c637828302e382e32382d646576656c6f702e323032342e31322e352b636f6d6d69742e39383863313261660059'

export const seismicContractConfig = {
  abi: contractABI,
  bytecode: CONTRACT_BYTECODE,
}

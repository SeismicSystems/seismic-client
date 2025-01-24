import { expect } from 'bun:test'
import { http } from 'viem'
import {
  type Chain,
  ChainFormatter,
  type ChainFormatters,
  type TransactionRequest,
  createPublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { FormattedTransactionRequest, extract, getAction } from 'viem/utils'

import {
  SeismicTransactionRequest,
  SeismicTxExtras,
  seismicDevnet,
  stringifyBigInt,
} from '@sviem/chain'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
  getSeismicClients,
} from '@sviem/client'
import { getShieldedContract } from '@sviem/index'

import { contractABI } from './contract/abi'
import { bytecode } from './contract/bytecode'
import { getDeployedAddress } from './utils'

// Define your formatter
// const formatters: ChainFormatters = {
//   transactionRequest: {
//     format: (tx: SeismicTransactionRequest) => {
//       console.log('formatter input', tx)
//       return {
//         ...tx,
//       }
//     },
//     type: 'transactionRequest',
//   },
// }

// // Define your custom chain
// export const customChain: Chain = {
//   id: 12345,
//   name: 'Custom Chain',
//   nativeCurrency: {
//     decimals: 18,
//     name: 'Custom Token',
//     symbol: 'CST',
//   },
//   rpcUrls: {
//     default: {
//       http: ['https://your-rpc-url.com'],
//     },
//     public: {
//       http: ['https://your-public-rpc-url.com'],
//     },
//   },
//   formatters,
//   // ... other chain properties
// }

// const TEST_PRIVATE_KEY =
//   '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
// const seismicClient = await getSeismicClients({
//   chain: customChain,
//   transport: http('http://localhost:8545'),
//   account: privateKeyToAccount(TEST_PRIVATE_KEY),
// })

// const publicClient = seismicClient.public
// const walletClient = seismicClient.wallet

// // TypeScript will now recognize your custom fields
// const tx: SeismicTransactionRequest = {
//   from: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
//   to: '0x0000000000000000000000000000000000000000',
//   //   gasPrice: 20000000000n,
//   gas: 6000000n,
//   value: 0n,
//   nonce: 0,
//   type: '0x4a',
//   data: '0x224bf76b7b416cf7956e92b4f2ddec31ce1879aeaa1c57f3e7eb12d4be60cd5b63bcd737ad8d90447dbb381900ba80e4a70fe4aef31d0138e4c215091a3977c078a69c1451e350bd07b2dfe53442e205e2a3c94d5a58e642839278540bcc7251712b78fa2726865b480c3df2b2b6adaef8795d4c714caac3b98084ce3c874a17ea3eb365f1405b989e1b3f000e8d031e3bd400a347b1fadb4fb50abb7a1445f75e29204c3f096e4a79ed1b5b8b1aeffb3ef6ba37ad2cb2db9709405c441657f7ea7717536c8836c85a5c57c3c9c29e2dfbb04297c6eaa535a2511f4f44be2da3e54f6c832b09e9d9abb09ea1271a2d60bbac825175ae82bf32aa4a34d02bf8f0903ca4efb4fb55798ba6e18b234ea6562bf168909e0fb69bf3473463f8dc848e577b2d88d1701fc47802fb26ed19b046c60df13a21021e10e1356a72e43db71ebaba30d77697670878ff26e34f7802df5d376c8bf8eab9162852fa5b699c3c6a2b788e5f5ebcf31000e4e97ff39fb1df9e45a6a4b26a986182d14238b7551e2fd07a74618204f83e02d645b8cb81aef520103da6c1a3a46008a512e6d8117eef7d4f704d28ffca8121062e6ce0be9ea267f3a5f9b79015fbd02a0d782079cdb0aa61e35c147454290cdcca8ea572ea46c0b470d1fc117761704631e68f949870bac6355c4af990526cc3f3bc2d2a12024810004b5c374aa58a4ca4827e21caf897400476e4e7f790005708ec9cf1edb8920e8d2f3b67bf01378a85155d9c134fe6ae41133cffaadc61092117f13eb0593d3291214c4468a49bbee78a9c8e134e9c7570310f1d339f4232ed5e003fb5a2bcf25afabd309667778e1eca0f9568ab377bf47be95076e7812031711835fb480a21d3d2a35839681274bb15e4f2b5850b786eaa3d207816661264fdb7b708d7ffdcb3afcae166a1130f3e78991c7bb0788488c4521539cb1106bc63',
//   encryptionPubkey:
//     '0x038318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed75',
// }

// const gas = await walletClient.estimateGas(tx)
// console.log('gas', gas)

const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const account = privateKeyToAccount(TEST_PRIVATE_KEY)

const transport = http('http://localhost:8545')

const seismicClient = await getSeismicClients({
  chain: seismicDevnet,
  transport,
  account,
})

const publicClient = seismicClient.public
const walletClient = seismicClient.wallet

const testContractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`
const TEST_NUMBER = BigInt(11)

const deployTx = await walletClient.deployContract({
  abi: contractABI,
  bytecode: testContractBytecodeFormatted,
})
await publicClient.waitForTransactionReceipt({ hash: deployTx })

const deployedContractAddress = await getDeployedAddress(
  publicClient,
  walletClient.account.address
)
console.info(`Deployed contract address: ${deployedContractAddress}`)

const seismicContract = getShieldedContract({
  abi: contractABI,
  address: deployedContractAddress,
  client: walletClient,
})

const isOdd0 = await walletClient.readContract({
  address: deployedContractAddress,
  abi: contractABI,
  functionName: 'isOdd',
})
// contract initializes number to be 0
expect(isOdd0).toBe(false)
console.info(`[0] initial value of isOdd = ${isOdd0}`)

// This is a seismic tx since the arg to setNumber is an suint
const tx1 = await seismicContract.write.setNumber([TEST_NUMBER])
console.info(`[1] Set number tx: ${tx1}`)
const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 })
console.info(
  `[1] setNumber receipt: ${JSON.stringify(receipt1, stringifyBigInt, 2)}`
)

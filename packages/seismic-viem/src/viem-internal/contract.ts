import type {
  Abi,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  ReadContractParameters,
  ReadContractReturnType,
  WriteContractParameters,
  WriteContractReturnType,
} from 'viem'

export type WriteContract<
  TChain extends Chain | undefined,
  TAccount extends Account | undefined,
  abi extends Abi | readonly unknown[] = Abi | readonly unknown[],
  functionName extends ContractFunctionName<
    abi,
    'payable' | 'nonpayable'
  > = ContractFunctionName<abi, 'payable' | 'nonpayable'>,
  args extends ContractFunctionArgs<
    abi,
    'payable' | 'nonpayable',
    functionName
  > = ContractFunctionArgs<abi, 'payable' | 'nonpayable', functionName>,
  TChainOverride extends Chain | undefined = undefined,
> = (
  args: WriteContractParameters<
    abi,
    functionName,
    args,
    TChain,
    TAccount,
    TChainOverride
  >
) => Promise<WriteContractReturnType>

export type ReadContract<
  TAbi extends Abi | readonly unknown[] = Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<
    TAbi,
    'nonpayable' | 'payable'
  > = ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  > = ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
> = (
  args: ReadContractParameters<TAbi, TFunctionName, TArgs>
) => Promise<ReadContractReturnType>

import type { AbiParametersToPrimitiveTypes, ExtractAbiFunction } from 'abitype'
import type {
  Abi,
  AbiFunction,
  ContractFunctionArgs,
  ContractFunctionName,
  Prettify,
  ReadContractParameters,
  ReadContractReturnType,
  UnionOmit,
} from 'viem'

export function getFunctionParameters(
  values: [args?: readonly unknown[] | undefined, options?: object | undefined]
) {
  const hasArgs = values.length && Array.isArray(values[0])
  const args = hasArgs ? values[0]! : []
  const options = (hasArgs ? values[1] : values[0]) ?? {}
  return { args, options }
}

export type GetReadFunction<
  narrowable extends boolean,
  abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'pure' | 'view'>,
  args extends ContractFunctionArgs<
    abi,
    'pure' | 'view',
    functionName
  > = ContractFunctionArgs<abi, 'pure' | 'view', functionName>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName>
    : AbiFunction,
  //
  _args = AbiParametersToPrimitiveTypes<abiFunction['inputs']>,
  _options = Prettify<
    UnionOmit<
      ReadContractParameters<abi, functionName, args>,
      'abi' | 'address' | 'args' | 'functionName'
    >
  >,
> = narrowable extends true
  ? (
      ...parameters: _args extends readonly []
        ? [options?: _options]
        : [args: _args, options?: _options]
    ) => Promise<ReadContractReturnType<abi, functionName, args>>
  : (
      ...parameters:
        | [options?: _options]
        | [args: readonly unknown[], options?: _options]
    ) => Promise<ReadContractReturnType>

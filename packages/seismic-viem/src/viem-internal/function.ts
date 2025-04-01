import type { AbiParametersToPrimitiveTypes, ExtractAbiFunction } from 'abitype'
import type {
  Abi,
  AbiFunction,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  IsUndefined,
  Or,
  Prettify,
  ReadContractParameters,
  ReadContractReturnType,
  UnionOmit,
  WriteContractParameters,
  WriteContractReturnType,
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

export type GetWriteFunction<
  narrowable extends boolean,
  chain extends Chain | undefined,
  account extends Account | undefined,
  abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  returnType = WriteContractReturnType,
  args extends ContractFunctionArgs<
    abi,
    'nonpayable' | 'payable',
    functionName
  > = ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName>
    : AbiFunction,
  //
  _args = AbiParametersToPrimitiveTypes<abiFunction['inputs']>,
  // For making `options` parameter required if `account` or `chain` is undefined
  _isOptionsRequired = Or<[IsUndefined<account>, IsUndefined<chain>]>,
> = narrowable extends true
  ? <
      chainOverride extends Chain | undefined,
      options extends Prettify<
        UnionOmit<
          WriteContractParameters<
            abi,
            functionName,
            args,
            chain,
            account,
            chainOverride
          >,
          'abi' | 'address' | 'args' | 'functionName'
        >
      >,
    >(
      ...parameters: _args extends readonly []
        ? _isOptionsRequired extends true
          ? [options: options]
          : [options?: options]
        : [
            args: _args,
            ...parameters: _isOptionsRequired extends true
              ? [options: options]
              : [options?: options],
          ]
    ) => Promise<returnType>
  : <
      chainOverride extends Chain | undefined,
      options extends Prettify<
        UnionOmit<
          WriteContractParameters<
            abi,
            functionName,
            args,
            chain,
            account,
            chainOverride
          >,
          'abi' | 'address' | 'args' | 'functionName'
        >
      >,
      Rest extends unknown[] = _isOptionsRequired extends true
        ? [options: options]
        : [options?: options],
    >(
      ...parameters: Rest | [args: readonly unknown[], ...parameters: Rest]
    ) => Promise<returnType>

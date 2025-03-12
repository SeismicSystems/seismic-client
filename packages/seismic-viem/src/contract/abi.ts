import {
  type AbiFunction,
  type AbiParameter,
  fromHex,
  sha256,
  toHex,
} from 'viem'

const isAnyTrue = (bools: boolean[]): boolean =>
  bools.reduce((acc, val) => acc || val, false)

const remapSeismicParam = (
  param: AbiParameter
): { shielded: boolean } & AbiParameter => {
  const ty = param.type
  if (ty.startsWith('tuple')) {
    const { components, ...rest } = param as unknown as AbiParameter & {
      components: AbiParameter[]
    }
    // const components = (param as unknown as { components: AbiParameter[]}).components
    const mappedComponents = components.map(remapSeismicParam)
    const shielded = isAnyTrue(mappedComponents.map(({ shielded }) => shielded))
    return {
      shielded,
      components: mappedComponents,
      ...rest,
    }
  }

  // sint/suint arrays
  if (ty.match(/suint\d+\[\d+\]/) || ty.match(/sint\d+\[\d+\]/)) {
    const baseType = ty.startsWith('suint') ? 'uint' : 'int'
    const bits = ty.match(/\d+/)![0]
    const arraySize = ty.match(/\[\d+\]/)![0]
    return { shielded: true, type: `${baseType}${bits}${arraySize}` }
  }

  // sint/suint single values
  if (ty.startsWith('suint') || ty.startsWith('sint')) {
    const bits = ty.slice(ty.startsWith('suint') ? 5 : 4)
    return {
      shielded: true,
      type: `${ty.startsWith('suint') ? 'uint' : 'int'}${bits}`,
    }
  }

  if (ty === 'sbool') {
    return { shielded: true, type: 'bool' }
  }
  if (ty === 'sbool[]') {
    return { shielded: true, type: 'bool[]' }
  }
  if (ty === 'saddress') {
    return { shielded: true, type: 'address' }
  }
  if (ty === 'saddress[]') {
    return { shielded: true, type: 'address[]' }
  }
  return { shielded: false, type: ty }
}

export const remapSeismicAbiInputs = (
  abiFunction: AbiFunction
): AbiFunction => {
  return {
    type: abiFunction.type,
    inputs: abiFunction.inputs.map((param) => {
      return remapSeismicParam(param)
    }),
    name: abiFunction.name,
    outputs: abiFunction.outputs,
    stateMutability: abiFunction.stateMutability,
  }
}

/*
 * Utility function to process arguments including fetching the ABI item
 */
export function getProcessedArgs<
  abiItem extends AbiFunction,
  args extends readonly unknown[] | undefined,
>(abiItem: abiItem, args: args): any[] {
  // Check if ABI item has inputs and arguments are provided
  if (abiItem.inputs.length === 0 || !args || args.length === 0) {
    return []
  }

  return abiItem.inputs.map((input, index) => {
    if (input.internalType === 'Suint') {
      const value = args[index] as bigint
      const hash = fromHex(sha256(toHex(value)), { to: 'bigint' })
      return hash
    }
    return args[index]
  })
}

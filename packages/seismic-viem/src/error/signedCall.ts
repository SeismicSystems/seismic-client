import { BaseError } from 'viem'

export type SignedCallErrorType = SignedCallError & {
  name: 'SignedCallError'
}

export class SignedCallError extends BaseError {
  constructor({
    docsPath,
    metaMessages,
    reason,
  }: {
    docsPath?: string | undefined
    metaMessages?: string[] | undefined
    reason: string
  }) {
    super(`Signed call failed: ${reason}`, {
      docsPath,
      metaMessages,
      name: 'SignedCallError',
    })
  }
}

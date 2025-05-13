import { ExactPartial } from 'viem'
import type { Chain, SendTransactionParameters } from 'viem'

export type AssertSeismicRequestParameters = ExactPartial<
  SendTransactionParameters<Chain>
>

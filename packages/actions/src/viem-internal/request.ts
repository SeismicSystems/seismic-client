import { Chain, ExactPartial, SendTransactionParameters } from 'viem'

export type AssertRequestParameters = ExactPartial<
  SendTransactionParameters<Chain>
>

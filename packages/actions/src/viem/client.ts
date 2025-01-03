import type { Account, Chain, Client, Transport } from 'viem'

export type KeyedClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
> =
  | {
      public?: Client<transport, chain> | undefined
      wallet: Client<transport, chain, account>
    }
  | {
      public: Client<transport, chain>
      wallet?: Client<transport, chain, account> | undefined
    }

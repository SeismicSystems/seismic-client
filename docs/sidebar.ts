import type { Sidebar } from 'vocs'

const viemSidebar = [
  {
    text: 'Introduction',
    link: '/viem/intro',
  },
  {
    text: 'Clients',
    collapsed: false,
    items: [
      { text: 'Shielded Public Client', link: '/viem/clients/public' },
      { text: 'Shielded Wallet Client', link: '/viem/clients/wallet' },
      { text: 'Encryption', link: '/viem/clients/encryption' },
    ],
  },
  {
    text: 'Contract',
    collapsed: false,
    items: [
      {
        text: 'Contract Instance',
        link: '/viem/contract/instance',
      },
      {
        text: 'Actions',
        items: [
          {
            text: 'Signed Read',
            link: '/viem/contract/signed-read',
          },
          {
            text: 'Shielded Write',
            link: '/viem/contract/shielded-write',
          },
        ],
      },
    ],
  },
  {
    text: 'Actions',
    collapsed: true,
    items: [
      {
        text: 'Public',
        link: '/viem/actions/public',
      },
      {
        text: 'Wallet',
        link: '/viem/actions/wallet',
      },
    ],
  },
  {
    text: 'Chains',
    collapsed: true,
    items: [
      {
        text: 'Chain Specs',
        items: [
          { text: 'sanvil', link: '/viem/chains/sanvil' },
          { text: 'testnet', link: '/viem/chains/testnet' },
          { text: 'local-devnet', link: '/viem/chains/local-devnet' },
        ],
      },
      {
        text: 'Create a new spec',
        link: '/viem/chains/create',
      },
      {
        text: 'Formatters',
        link: '/viem/chains/formatters',
      },
    ],
  },
  {
    text: 'Precompiles',
    collapsed: true,
    items: [
      {
        text: 'Introduction',
        link: '/viem/precompiles/precompile',
      },
      {
        text: 'RNG',
        link: '/viem/precompiles/rng',
      },
      {
        text: 'ECDH',
        link: '/viem/precompiles/ecdh',
      },
      {
        text: 'AES-GCM Encryption',
        link: '/viem/precompiles/aes',
      },
      {
        text: 'HKDF',
        link: '/viem/precompiles/hdfk',
      },
      {
        text: 'Secp256k1 Signature',
        link: '/viem/precompiles/secp256k1-sig',
      },
    ],
  },
  {
    text: 'Explorer',
    collapsed: true,
    items: [
      {
        text: 'URL',
        link: '/viem/explorer/url',
      },
      {
        text: 'Address',
        link: '/viem/explorer/address',
      },
      {
        text: 'Transaction',
        link: '/viem/explorer/tx',
      },
      {
        text: 'Block',
        link: '/viem/explorer/block',
      },
      {
        text: 'Token',
        link: '/viem/explorer/token',
      },
    ],
  },
]

const reactSidebar = [
  {
    text: 'Introduction',
    link: '/react/intro',
  },
  {
    text: 'Context',
    collapsed: false,
    items: [
      {
        text: 'Shielded Wallet Provider',
        link: '/react/context/provider',
      },
    ],
  },
  {
    text: 'Hooks',
    collapsed: false,
    items: [
      {
        text: 'Shielded Wallet Provider',
        link: '/react/hooks/wallet',
      },
      {
        text: 'Shielded Contract Instance',
        link: '/react/hooks/contract',
      },
      {
        text: 'Shielded Read Contract',
        link: '/react/hooks/signed-read-contract',
      },
      {
        text: 'Shielded Write Contract',
        link: '/react/hooks/shielded-write-contract',
      },
    ],
  },
  {
    text: 'Guides',
    collapsed: false,
    items: [
      {
        text: 'RainbowKit',
        link: '/react/guides/rainbowkit',
      },
      {
        text: 'Privy',
        link: '/react/guides/privy',
      },
      {
        text: 'AppKit',
        link: '/react/guides/appkit',
      },
    ],
  },
]

export const sidebar = {
  // '/': [...viemSidebar, ...reactSidebar],
  '/': [
    {
      text: 'Viem',
      items: viemSidebar,
    },
    {
      text: 'React',
      items: reactSidebar,
    },
  ],
  // '/viem': viemSidebar,
  // '/react': reactSidebar,
  // {
  //   text: 'Introduction',
  //   items: [
  //     { text: 'Why Viem', link: '/docs/introduction' },
  //     { text: 'Installation', link: '/docs/installation' },
  //     { text: 'Getting Started', link: '/docs/getting-started' },
  //   ],
  // },
  // {
  //   text: 'Guides',
  //   items: [
  //     { text: 'Migration Guide', link: '/docs/migration-guide' },
  //     { text: 'Ethers v5 → viem', link: '/docs/ethers-migration' },
  //     { text: 'TypeScript', link: '/docs/typescript' },
  //     { text: 'Error Handling', link: '/docs/error-handling' },
  //     { text: 'Blob Transactions', link: '/docs/guides/blob-transactions' },
  //   ],
  // },
  // {
  //   text: 'Glossary',
  //   collapsed: true,
  //   items: [
  //     { text: 'Terms', link: '/viem/glossary/terms' },
  //     { text: 'Types', link: '/viem/glossary/types' },
  //     { text: 'Errors', link: '/viem/glossary/errors' },
  //   ],
  // },
} as const satisfies Sidebar

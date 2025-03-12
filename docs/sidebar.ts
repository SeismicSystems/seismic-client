import type { Sidebar } from 'vocs'

const viemSidebar = [
  {
    text: 'Clients',
    items: [
      { text: 'Shielded Public Client', link: '/viem/clients/public' },
      { text: 'Shielded Wallet Client', link: '/viem/clients/wallet' },
    ],
  },
  {
    text: 'Public Actions',
    collapsed: true,
    items: [],
  },
  {
    text: 'Wallet Actions',
    collapsed: true,
    items: [],
  },
  {
    text: 'Contract',
    collapsed: true,
    items: [
      {
        text: 'Contract Instances',
        link: '/viem/contract/getShieldedContract',
      },
      {
        text: 'Actions',
        items: [
          {
            text: 'signedReadContract',
            link: '/viem/contract/signedReadContract',
          },
          {
            text: 'shieldedWriteContract',
            link: '/viem/contract/shieldedWriteContract',
          },
        ],
      },
    ],
  },
  {
    text: 'Chains',
    collapsed: true,
    items: [
      {
        text: 'Introduction',
        link: '/viem/chains/introduction',
      },
      {
        text: 'Chain Specs',
        items: [
          { text: 'devnet1', link: '/viem/chains/devnet1' },
          { text: 'devnet2', link: '/viem/chains/devnet2' },
          { text: 'sanvil', link: '/viem/chains/sanvil' },
        ],
      },
      {
        text: 'Custom',
        items: [{ text: 'devnet', link: '/viem/chains/custom/devnet' }],
      },
    ],
  },
  {
    text: 'Precompiles',
    collapsed: true,
    items: [
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
        link: '/viem/precompiles/secp256k1',
      },
    ],
  },
]

const reactSidebar = [
  {
    text: 'Introduction',
    link: '/react/introduction',
  },
]

export const sidebar = {
  '/': [...viemSidebar, ...reactSidebar],
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

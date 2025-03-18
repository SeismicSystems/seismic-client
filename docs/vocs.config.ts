import { defineConfig } from 'vocs'
import type { Config } from 'vocs'

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import { sidebar } from './sidebar.ts'

const config: Config = defineConfig({
  title: 'Seismic Client',
  description: 'Build apps on the Seismic network',
  theme: {
    accentColor: {
      light: '#ff9318',
      dark: '#ffc517',
    },
  },
  rootDir: '.',
  sidebar,
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/SeismicSystems/seismic-client',
    },
    {
      icon: 'discord',
      link: 'https://discord.gg/MnMJ37JN',
    },
    {
      icon: 'x',
      link: 'https://x.com/SeismicSys',
    },
  ],
  topNav: [
    { text: 'Viem', link: '/viem/intro' },
    { text: 'React', link: '/react/intro' },
  ],
})

export default config

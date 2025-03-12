import { defineConfig } from 'vocs'

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import { sidebar } from './sidebar'

export default defineConfig({
  title: 'Seismic Client',
  description: 'Build apps on the Seismic network',
  theme: {
    variables: {
      content: {
        horizontalPadding: '200px',
        verticalPadding: '20px',
        width: 'min(100%, 2000px)',
      },
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
})

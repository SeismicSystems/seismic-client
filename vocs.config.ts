import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'Seismic Viem',
  description: 'Build Seismic apps by extending viem',
  theme: {
    variables: {
      content: {
        horizontalPadding: '200px',
        verticalPadding: '20px',
        width: 'min(100%, 2000px)',
      },
    },
  },
})

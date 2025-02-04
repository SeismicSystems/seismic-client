import { defineConfig } from 'vocs'

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
})

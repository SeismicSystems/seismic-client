import fs from 'fs'
import path from 'path'
import type { Config } from 'vocs'
import { defineConfig } from 'vocs'

const config: Config = defineConfig({
  title: 'Seismic Viem',
  description: 'Build Seismic apps by extending viem',
})

export default config

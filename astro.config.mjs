import { defineConfig } from 'astro/config'
import { shield } from '@kindspells/astro-shield'

export default defineConfig({
  integrations: [
    shield({})
  ]
})
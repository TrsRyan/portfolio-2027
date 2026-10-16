import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '81dz5o0t',
    dataset: 'production',
  },
  // The queries live in the site, so the types are generated there too.
  typegen: {
    path: '../src/**/*.{ts,tsx}',
    schema: 'schema.json',
    generates: '../src/sanity.types.ts',
  },
  deployment: {
    autoUpdates: true,
    appId: 'ntvz0k435dn2n1ve71crsz1x',
  },
})

import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '81dz5o0t',
    dataset: 'production',
  },
  /**
   * TypeGen — generates TS types from the schema + the site's GROQ queries.
   * The queries live on the site side (../src); the types file is also
   * written there so it can be imported via the `@/sanity.types` alias.
   * Regenerate with: `npm run typegen` (here, inside studio/).
   */
  typegen: {
    path: '../src/**/*.{ts,tsx}',
    schema: 'schema.json',
    generates: '../src/sanity.types.ts',
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
})

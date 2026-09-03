import { type SchemaTypeDefinition } from 'sanity'

import { projectType } from './projectType'
import { settingsType } from './settingsType'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [projectType, settingsType],
}
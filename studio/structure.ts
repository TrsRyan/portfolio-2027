import type {StructureResolver} from 'sanity/structure'

// Single-instance types (singletons): locked to a fixed _id and excluded
// from the generic list to avoid duplicates. See studio-structure best practices.
const SINGLETONS = ['settings']

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Contenu')
    .items([
      // 1. Singletons first
      S.listItem()
        .id('settings')
        .title('Réglages du site')
        .child(
          S.document().schemaType('settings').documentId('settings').title('Réglages du site'),
        ),

      S.divider(),

      // 2. The rest of the document types (project…), filtered of singletons
      ...S.documentTypeListItems().filter(
        (listItem) => !SINGLETONS.includes(listItem.getId() as string),
      ),
    ])

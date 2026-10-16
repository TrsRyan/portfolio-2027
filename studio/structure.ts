import type {StructureResolver} from 'sanity/structure'

// Singletons get a fixed _id and are left out of the generic list.
const SINGLETONS = ['settings']

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Contenu')
    .items([
      S.listItem()
        .id('settings')
        .title('Réglages du site')
        .child(
          S.document().schemaType('settings').documentId('settings').title('Réglages du site'),
        ),

      S.divider(),

      ...S.documentTypeListItems().filter(
        (listItem) => !SINGLETONS.includes(listItem.getId() as string),
      ),
    ])

# Publication metadata

The text metadata panel is implemented by [`metadata.component.html`](../src/app/components/collection-text-types/metadata/metadata.component.html) and uses the normalized metadata types and mappers in [`metadata.models.ts`](../src/app/models/metadata.models.ts).

The backend response may omit supported fields. Unknown fields are accepted by the API response interfaces and ignored by the UI. The mapper normalizes missing scalar values to `null` and missing arrays to empty arrays, unless noted below. The template renders a field only when it has a displayable value.

## Shared shapes

Index-linked metadata entries use this shape:

```ts
interface MetadataIndexEntry {
  id: string | number;
  name: string;
}
```

`persons`, `places`, and structured `keywords` entries link to the index pages with the entry `id` as query parameter:

- `persons`: `/index/persons?id=<id>`
- `places`: `/index/places?id=<id>`
- `keywords`: `/index/keywords?id=<id>`

Entries missing either `id` or `name` are filtered out by the mapper. If no valid entries remain, the normalized value is `null` and the field is not rendered.

Editorial responsibility entries use this shape:

```ts
interface ResponsibilityMetadata {
  resp: string;
  names: string[];
}
```

`responsibility` is supported on publications, manuscripts, and variants. Each responsibility entry renders as one outer list item, where `resp` is the item label and `names` renders as a nested unordered list displayed inline with comma separators. Entries with neither a `resp` nor any valid `names` are filtered out by the mapper.

## HTML fields

Some backend metadata values may contain stringified HTML. These fields are bound with Angular `[innerHTML]` in the template:

- Publication fields: `publication_title`, `publication_subtitle`, `published_by`, `responsibility.names`, `phys_description`, `source_archive`, `source_bibl`, `facsimile_summary`, `rights`, `licence`, `licence_encoding`, `licence_work`
- Manuscript fields: `title`, `responsibility.names`, `phys_description`, `source_archive`, `source_bibl`, `facsimile_summary`, `rights`, `licence`, `licence_encoding`, `licence_work`
- Variant fields: `title`, `responsibility.names`, `phys_description`, `source_archive`, `source_bibl`, `facsimile_summary`, `rights`, `licence`, `licence_encoding`, `licence_work`
- Facsimile fields: `facsimile_title`

Angular sanitizes values bound with `[innerHTML]`. Do not use these fields for scripts or event-handler attributes.

## Publication fields

Top-level publication fields are rendered in the main `<dl>` metadata block.

| Field | Normalized type | Rendering |
| --- | --- | --- |
| `publication_title` | `string \| null` | Document title, HTML-enabled. |
| `publication_subtitle` | `string \| null` | Subtitle, HTML-enabled. |
| `published_by` | `string \| null` | Publication/source title, HTML-enabled. |
| `author` | `string[]` | One value per line, with singular/plural label. |
| `sender` | `string[]` | One value per line, with singular/plural label. |
| `recipient` | `string[]` | One value per line, with singular/plural label. |
| `responsibility` | `ResponsibilityMetadata[]` | Editorial preparation. Renders as an unordered list, one item per `resp`, with nested HTML-enabled `names` displayed inline and comma-separated. |
| `publication_date` | `string \| null` | Plain text date. |
| `document_type` | `string \| null` | Plain text document type. |
| `publication_genre` | `string \| null` | Plain text genre. |
| `original_language` | `string \| null` | Plain text original language. |
| `publication_language` | `string \| null` | Plain text publication language. |
| `persons` | `MetadataIndexEntry[] \| null` | One link per line to the persons index. |
| `places` | `MetadataIndexEntry[] \| null` | One link per line to the places index. |
| `keywords` | `string \| MetadataIndexEntry[] \| null` | Plain text when a string; otherwise one link per line to the keywords index. |
| `phys_description` | `string \| null` | Physical description, HTML-enabled. |
| `phys_dimensions` | `string \| null` | Plain text physical dimensions. |
| `source_archive` | `string \| null` | Archive/source information, HTML-enabled. |
| `source_bibl` | `string \| null` | Bibliographic source, HTML-enabled. |
| `facsimile_summary` | `string \| null` | Facsimile summary, HTML-enabled. |
| `rights` | `string \| null` | Rights statement, HTML-enabled. |
| `licence` | `string \| null` | General licence, HTML-enabled. |
| `licence_encoding` | `string \| null` | TEI file licence, HTML-enabled. |
| `licence_work` | `string \| null` | Work licence, HTML-enabled. |
| `translations` | `TranslationMetadata[]` | Renders translators as `name (language)` when translator data is present. |

The normalized `PublicationMetadata` interface also contains `id`, `collection_id`, `collection_title`, and `manuscript_id`. These fields are accepted and normalized but are not currently rendered by the metadata component.

## Manuscript fields

`manuscripts` is normalized to `ManuscriptMetadata[]`. If it contains entries, the component renders a manuscript heading and one unordered list item per entry, preserving the array order from the backend.

| Field | Normalized type | Rendering |
| --- | --- | --- |
| `title` | `string \| null` | Manuscript title, HTML-enabled. |
| `author` | `string[]` | One value per line, with singular/plural label. |
| `responsibility` | `ResponsibilityMetadata[]` | Editorial preparation. Renders as an unordered list, one item per `resp`, with nested HTML-enabled `names` displayed inline and comma-separated. |
| `orig_date` | `string \| null` | Plain text date. |
| `language` | `string \| null` | Plain text language. |
| `phys_description` | `string \| null` | Physical description, HTML-enabled. |
| `phys_dimensions` | `string \| null` | Plain text physical dimensions. |
| `source_archive` | `string \| null` | Archive/source information, HTML-enabled. |
| `source_bibl` | `string \| null` | Bibliographic source, HTML-enabled. |
| `facsimile_summary` | `string \| null` | Facsimile summary, HTML-enabled. |
| `rights` | `string \| null` | Rights statement, HTML-enabled. |
| `licence` | `string \| null` | General licence, HTML-enabled. |
| `licence_encoding` | `string \| null` | TEI file licence, HTML-enabled. |
| `licence_work` | `string \| null` | Work licence, HTML-enabled. |

The normalized manuscript interface also contains `id` and `sort_order`. These fields are accepted and normalized but are not currently rendered or used for sorting by the component.

## Variant fields

`variants` is normalized to `VariantMetadata[]`. If it contains entries, the component renders a variant heading and one unordered list item per entry, preserving the array order from the backend.

| Field | Normalized type | Rendering |
| --- | --- | --- |
| `title` | `string \| null` | Variant title, HTML-enabled. If `type === 0`, the title is annotated as the base text. |
| `author` | `string[]` | One value per line, with singular/plural label. |
| `responsibility` | `ResponsibilityMetadata[]` | Editorial preparation. Renders as an unordered list, one item per `resp`, with nested HTML-enabled `names` displayed inline and comma-separated. |
| `orig_date` | `string \| null` | Plain text date. |
| `language` | `string \| null` | Plain text language. |
| `phys_description` | `string \| null` | Physical description, HTML-enabled. |
| `phys_dimensions` | `string \| null` | Plain text physical dimensions. |
| `source_archive` | `string \| null` | Archive/source information, HTML-enabled. |
| `source_bibl` | `string \| null` | Bibliographic source, HTML-enabled. |
| `facsimile_summary` | `string \| null` | Facsimile summary, HTML-enabled. |
| `rights` | `string \| null` | Rights statement, HTML-enabled. |
| `licence` | `string \| null` | General licence, HTML-enabled. |
| `licence_encoding` | `string \| null` | TEI file licence, HTML-enabled. |
| `licence_work` | `string \| null` | Work licence, HTML-enabled. |

The normalized variant interface also contains `id`, `sort_order`, and `type`. `type` is used only to add the base-text annotation when it is `0`; it is not rendered as a separate metadata row.

## Facsimile fields

`facsimiles` is normalized to `FacsimileMetadata[]`. If it contains entries, the component renders a facsimile heading and one unordered list item per entry, preserving the array order from the backend.

| Field | Normalized type | Rendering |
| --- | --- | --- |
| `facsimile_title` | `string \| null` | Facsimile title, HTML-enabled. The API field `title` is used as fallback. Hidden when it matches the publication title and there is only one facsimile. |
| `archive_info` | `string \| null` | Plain text archive/source information. |
| `number_of_images` | `number \| null` | Plain text image count. |
| `image_number_info` | `string \| null` | Plain text image number information. |
| `external_url` | `string \| null` | Link whose href and label are the URL. |

The normalized facsimile interface also contains `facs_coll_id` and `priority`. These fields are accepted and normalized but are not currently rendered by the metadata component.

## Adding fields

When adding a metadata field, update the API response interface, normalized interface, mapper, template, i18n labels, and this document. If the value may contain HTML, render it with `[innerHTML]` and list it in the HTML fields section above.

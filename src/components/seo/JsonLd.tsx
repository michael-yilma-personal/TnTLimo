/**
 * Renders a JSON-LD payload as a <script type="application/ld+json"> tag.
 *
 * `<` is escaped to its unicode form before serialisation, per the Next.js
 * JSON-LD guide: JSON.stringify does not sanitise strings, and our payloads
 * include copy (FAQ answers, descriptions) that is editable content.
 */
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

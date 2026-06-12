// Minimal JSON-LD renderer — outputs a <script type="application/ld+json">
// tag with safely escaped content. Accepts a single schema object or an array.
// Server component only (no "use client" needed).

type JsonLdData = Record<string, unknown> | Record<string, unknown>[];

export default function JsonLd({ data }: { data: JsonLdData }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}

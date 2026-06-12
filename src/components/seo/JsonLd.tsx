// JsonLd — lightweight server-side JSON-LD renderer.
//
// Renders a <script type="application/ld+json"> tag with safely escaped
// JSON content. Accepts a single schema object or an array of schema objects.
//
// Usage:
//   import JsonLd from "@/components/seo/JsonLd";
//   <JsonLd data={organizationSchema()} />
//   <JsonLd data={[serviceSchema(...), breadcrumbSchema(...)]} />
//
// No client-side JavaScript required — this is a pure server component.

type JsonLdData = Record<string, unknown> | Record<string, unknown>[];

export default function JsonLd({ data }: { data: JsonLdData }) {
  // Escape < to prevent XSS when embedding in HTML.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

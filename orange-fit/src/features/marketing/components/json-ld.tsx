import { serializeJsonLd } from "../seo";

/** Datos estructurados (schema.org). El contenido se escapa para que no pueda cerrar el <script>. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

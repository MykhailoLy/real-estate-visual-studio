import { permanentRedirect } from "next/navigation";

export default function SpanishServicesRedirectPage(): never {
  permanentRedirect("/es/pricing");
}

import { permanentRedirect } from "next/navigation";

export default function ServicesRedirectPage(): never {
  permanentRedirect("/pricing");
}

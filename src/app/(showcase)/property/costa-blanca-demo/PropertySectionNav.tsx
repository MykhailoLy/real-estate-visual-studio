import {
  BookOpenText,
  House,
  Images,
  Mail,
  MapPinned,
  PanelsTopLeft,
  ScanLine,
} from "lucide-react";

const sections = [
  { href: "#home", label: "Home", icon: House },
  { href: "#overview", label: "Overview", icon: BookOpenText },
  { href: "#gallery", label: "Gallery", icon: Images },
  { href: "#virtual-tour", label: "360 tour", icon: ScanLine },
  { href: "#floor-plan", label: "Floor plans", icon: PanelsTopLeft },
  { href: "#location", label: "Location", icon: MapPinned },
  { href: "#contact", label: "Contact", icon: Mail },
];

export default function PropertySectionNav() {
  return (
    <nav
      aria-label="Property page sections"
      className="sticky top-16 z-30 border-b border-black/8 bg-white/94 shadow-[0_10px_35px_rgba(15,36,64,0.06)] backdrop-blur"
    >
      <div className="mx-auto max-w-[1480px] overflow-x-auto px-2 sm:px-6 lg:px-10">
        <div className="flex min-w-max items-stretch justify-start lg:justify-center">
          {sections.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="group flex min-w-[86px] flex-col items-center justify-center gap-1.5 border-b-2 border-transparent px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 transition hover:border-[#c7a94e] hover:bg-[#f7f4ec] hover:text-[#0f2440] sm:min-w-[104px] sm:flex-row sm:gap-2 sm:px-4 sm:text-xs sm:normal-case sm:tracking-normal"
            >
              <Icon className="h-5 w-5 text-[#1a365d] transition group-hover:text-[#a88b3a]" aria-hidden />
              <span>{label}</span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

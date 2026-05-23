import { Upload, Check } from "lucide-react";

interface UploadItem {
  label: string;
  required?: boolean;
  hint?: string;
}

interface UploadRequirementsBlockProps {
  title?: string;
  subtitle?: string;
  items: (string | UploadItem)[];
  footnote?: string;
}

/**
 * Block listing what the client needs to upload / provide for a service.
 * Designed as a clear, scannable checklist.
 */
export default function UploadRequirementsBlock({
  title = "What to upload",
  subtitle,
  items,
  footnote,
}: UploadRequirementsBlockProps) {
  const normalized: UploadItem[] = items.map((it) =>
    typeof it === "string" ? { label: it } : it
  );

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 shadow-sm">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg lg:text-xl font-bold text-primary tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm lg:text-base text-muted mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {normalized.map((item) => (
          <li
            key={item.label}
            className="flex items-start gap-2.5 text-sm lg:text-base text-foreground"
          >
            <Check className="w-4 h-4 text-secondary-dark mt-1 flex-shrink-0" />
            <div>
              <span>
                {item.label}
                {item.required && (
                  <span className="text-secondary-dark ml-1">*</span>
                )}
              </span>
              {item.hint && (
                <span className="block text-xs text-muted mt-0.5">
                  {item.hint}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {footnote && (
        <p className="text-xs lg:text-sm text-muted mt-6 leading-relaxed border-t border-stone-100 pt-4">
          {footnote}
        </p>
      )}
    </div>
  );
}

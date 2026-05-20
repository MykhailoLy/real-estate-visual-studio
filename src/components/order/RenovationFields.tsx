"use client";

interface RenovationFieldsProps {
  data: {
    instructions: string;
    elements_to_keep: string;
    elements_to_remove: string;
    elements_to_replace: string;
    preferred_materials: string;
    reference_link: string;
    notes: string;
  };
  onChange: (data: RenovationFieldsProps["data"]) => void;
}

export default function RenovationFields({ data, onChange }: RenovationFieldsProps) {
  const update = (field: keyof typeof data, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Renovation Instructions <span className="text-red-500">*</span>
        </label>
        <textarea
          value={data.instructions}
          onChange={(e) => update("instructions", e.target.value)}
          placeholder="Describe what you want changed (e.g., 'Replace old kitchen cabinets with modern white handleless ones, add marble countertop...')"
          rows={3}
          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Elements to Keep
          </label>
          <textarea
            value={data.elements_to_keep}
            onChange={(e) => update("elements_to_keep", e.target.value)}
            placeholder="Windows, ceiling, layout..."
            rows={2}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Elements to Remove
          </label>
          <textarea
            value={data.elements_to_remove}
            onChange={(e) => update("elements_to_remove", e.target.value)}
            placeholder="Old cabinets, dated tiles..."
            rows={2}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Elements to Replace
          </label>
          <textarea
            value={data.elements_to_replace}
            onChange={(e) => update("elements_to_replace", e.target.value)}
            placeholder="Flooring, countertops..."
            rows={2}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Preferred Materials / Style
        </label>
        <input
          type="text"
          value={data.preferred_materials}
          onChange={(e) => update("preferred_materials", e.target.value)}
          placeholder="Modern white, marble, oak wood, minimalist..."
          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Reference Link
        </label>
        <input
          type="url"
          value={data.reference_link}
          onChange={(e) => update("reference_link", e.target.value)}
          placeholder="https://example.com/inspiration"
          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Additional Notes
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Anything else we should know..."
          rows={2}
          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  );
}

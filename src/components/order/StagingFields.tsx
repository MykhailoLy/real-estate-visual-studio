"use client";

interface StagingFieldsProps {
  data: {
    room_type: string;
    interior_style: string;
    notes: string;
    reference_link: string;
  };
  onChange: (data: StagingFieldsProps["data"]) => void;
}

const roomTypes = [
  "Living Room",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Dining Room",
  "Office",
  "Outdoor/Terrace",
  "Other",
];

const interiorStyles = [
  "Modern",
  "Scandinavian",
  "Mid-Century",
  "Industrial",
  "Coastal",
  "Classic",
  "Minimalist",
  "Rustic",
  "Luxury",
  "Other",
];

export default function StagingFields({ data, onChange }: StagingFieldsProps) {
  const update = (field: keyof typeof data, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Room Type <span className="text-red-500">*</span>
          </label>
          <select
            value={data.room_type}
            onChange={(e) => update("room_type", e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select room type...</option>
            {roomTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Interior Style <span className="text-red-500">*</span>
          </label>
          <select
            value={data.interior_style}
            onChange={(e) => update("interior_style", e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select style...</option>
            {interiorStyles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Notes / Instructions
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Any specific requirements for this image..."
          rows={2}
          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
    </div>
  );
}

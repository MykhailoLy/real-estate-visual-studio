"use client";

interface PhotoEditFieldsProps {
  data: {
    editing_types: string[];
    notes: string;
  };
  onChange: (data: PhotoEditFieldsProps["data"]) => void;
}

const editingOptions = [
  "Color correction",
  "HDR blending",
  "Sky replacement",
  "Lens correction",
  "Object removal",
  "Twilight conversion",
  "Grass/garden enhancement",
  "Other",
];

export default function PhotoEditFields({ data, onChange }: PhotoEditFieldsProps) {
  const toggleType = (type: string) => {
    const current = data.editing_types;
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onChange({ ...data, editing_types: updated });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Editing Required <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-muted mb-3">Select all that apply.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {editingOptions.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:bg-surface cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={data.editing_types.includes(option)}
                onChange={() => toggleType(option)}
                className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
              />
              <span className="text-sm text-foreground">{option}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Notes / Instructions
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          placeholder="Specific editing instructions..."
          rows={2}
          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  );
}

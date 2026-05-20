"use client";

interface FloorPlanFieldsProps {
  data: {
    property_type: string;
    number_of_floors: number;
    output_type: string;
    notes: string;
  };
  onChange: (data: FloorPlanFieldsProps["data"]) => void;
}

const propertyTypes = ["Apartment", "House", "Villa", "Commercial", "Other"];

export default function FloorPlanFields({ data, onChange }: FloorPlanFieldsProps) {
  const update = (field: keyof typeof data, value: string | number) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Property Type <span className="text-red-500">*</span>
          </label>
          <select
            value={data.property_type}
            onChange={(e) => update("property_type", e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select type...</option>
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Number of Floors <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={data.number_of_floors}
            onChange={(e) => update("number_of_floors", parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Output Type <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          {["2D", "3D", "Both"].map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="output_type"
                value={type}
                checked={data.output_type === type}
                onChange={(e) => update("output_type", e.target.value)}
                className="w-4 h-4 text-primary border-border focus:ring-primary"
              />
              <span className="text-sm text-foreground">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Notes
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Special requirements, measurements to include..."
          rows={2}
          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  );
}

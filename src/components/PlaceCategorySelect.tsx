import type { PlaceCategoryOption } from "~/lib/place";

type PlaceCategorySelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: PlaceCategoryOption[];
  placeholder?: string;
  disabled?: boolean;
  includeDisabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  id?: string;
  className?: string;
};

function formatOptionLabel(option: PlaceCategoryOption): string {
  const prefix = option.depth > 0 ? `${"  ".repeat(option.depth)}↳ ` : "";
  return `${prefix}${option.emoji} ${option.label}`;
}

export function PlaceCategorySelect({
  value,
  onChange,
  options,
  placeholder = "Select a category",
  disabled = false,
  includeDisabled = false,
  allowEmpty = true,
  emptyLabel,
  id,
  className,
}: PlaceCategorySelectProps) {
  const visibleOptions = includeDisabled
    ? options
    : options.filter((option) => option.enabled);

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${className ?? ""}`}
    >
      {allowEmpty && (
        <option value="">
          {emptyLabel ?? placeholder}
        </option>
      )}
      {visibleOptions.map((option) => (
        <option key={option.slug} value={option.slug} disabled={!includeDisabled && !option.enabled}>
          {formatOptionLabel(option)}
        </option>
      ))}
    </select>
  );
}

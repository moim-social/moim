import { useState, useMemo } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "~/components/ui/command";

type TimezoneEntry = {
  id: string;
  label: string;
  offset: string;
  region: string;
};

function getUtcOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value ?? "";
  } catch {
    return "";
  }
}

function buildTimezoneList(): TimezoneEntry[] {
  const timezones = Intl.supportedValuesOf("timeZone");
  return timezones.map((tz) => {
    const parts = tz.split("/");
    const region = parts[0];
    const city = parts.slice(1).join("/").replace(/_/g, " ");
    const offset = getUtcOffset(tz);
    return {
      id: tz,
      label: city || tz,
      offset,
      region,
    };
  });
}

let cachedTimezones: TimezoneEntry[] | null = null;
function getTimezones(): TimezoneEntry[] {
  if (!cachedTimezones) {
    cachedTimezones = buildTimezoneList();
  }
  return cachedTimezones;
}

export function TimezonePicker({
  value,
  onChange,
  placeholder = "Select timezone...",
  showAutoOption = false,
  autoLabel = "Auto (instance default)",
}: {
  value: string | null;
  onChange: (tz: string | null) => void;
  placeholder?: string;
  showAutoOption?: boolean;
  autoLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const timezones = useMemo(() => getTimezones(), []);

  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  // Only show results when user is searching, otherwise show browser TZ + selected
  const filtered = useMemo(() => {
    if (!search.trim()) {
      const quick: TimezoneEntry[] = [];
      const browserEntry = timezones.find((tz) => tz.id === browserTz);
      if (browserEntry) quick.push(browserEntry);
      if (value && value !== browserTz) {
        const selectedEntry = timezones.find((tz) => tz.id === value);
        if (selectedEntry) quick.push(selectedEntry);
      }
      return quick;
    }
    const q = search.toLowerCase();
    return timezones
      .filter((tz) => tz.id.toLowerCase().includes(q) || tz.label.toLowerCase().includes(q))
      .slice(0, 10);
  }, [search, timezones, browserTz, value]);

  const selectedEntry = value
    ? timezones.find((tz) => tz.id === value)
    : null;

  const displayText = selectedEntry
    ? `${selectedEntry.id} (${selectedEntry.offset})`
    : showAutoOption
      ? autoLabel
      : placeholder;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search timezone..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            {showAutoOption && (
              <CommandGroup>
                <CommandItem
                  value="__auto__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      value === null ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {autoLabel}
                </CommandItem>
              </CommandGroup>
            )}
            {!search.trim() ? (
              // Default view: just browser TZ + current selection
              <CommandGroup heading="Suggested">
                {filtered.map((tz) => (
                  <CommandItem
                    key={tz.id}
                    value={`${tz.id} ${tz.label}`}
                    onSelect={() => {
                      onChange(tz.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4",
                        value === tz.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{tz.label}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {tz.offset}
                    </span>
                    {tz.id === browserTz && (
                      <span className="text-muted-foreground text-xs ml-1">(local)</span>
                    )}
                  </CommandItem>
                ))}
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  Type to search all timezones...
                </p>
              </CommandGroup>
            ) : (
              // Search view: top 10 matches
              filtered.map((tz) => (
                <CommandItem
                  key={tz.id}
                  value={`${tz.id} ${tz.label}`}
                  onSelect={() => {
                    onChange(tz.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      value === tz.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">
                    {tz.label}
                    <span className="text-muted-foreground ml-1 text-xs">{tz.region}</span>
                  </span>
                  <span className="text-muted-foreground text-xs ml-2">
                    {tz.offset}
                  </span>
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

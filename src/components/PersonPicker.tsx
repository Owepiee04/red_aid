"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/domain";

type Person = Pick<Profile, "id" | "full_name" | "email" | "photo_url">;

interface PersonPickerProps {
  people?: Person[];
  selectedIds?: string[];
  onToggle: (id: string) => void;
  placeholder?: string;
}

/** Searchable multi-select of people, used when assigning staff to an event. */
export default function PersonPicker({
  people = [],
  selectedIds = [],
  onToggle,
  placeholder = "Search by name",
}: PersonPickerProps) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const filtered = people.filter((person) =>
    `${person.full_name ?? ""} ${person.email ?? ""}`.toLowerCase().includes(term)
  );

  return (
    <div className="rounded-xl border border-border">
      <div className="relative border-b border-border">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="border-0 pl-9 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="max-h-52 overflow-y-auto p-1.5">
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No one matches that search.</p>
        )}
        {filtered.map((person) => {
          const checked = selectedIds.includes(person.id);
          return (
            <label
              key={person.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                checked ? "bg-accent" : "hover:bg-muted"
              )}
            >
              <Checkbox checked={checked} onCheckedChange={() => onToggle(person.id)} />
              <UserAvatar
                uri={person.photo_url}
                name={person.full_name}
                className="h-8 w-8"
                textClassName="text-xs"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{person.full_name || person.email}</span>
                <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

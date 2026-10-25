"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";
import UserAvatar from "@/components/UserAvatar";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import RoleSelect from "@/components/RoleSelect";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";
import { listStaff, setAccountActive } from "@/lib/data/profiles";
import type { DutyRole } from "@/types/auth";
import type { Profile } from "@/types/domain";

type RoleFilter = "all" | DutyRole;

export default function ManageAccountsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: users, loading, error, load } = useData(
    () =>
      listStaff({
        role: roleFilter === "all" ? undefined : roleFilter,
        search: debouncedSearch,
      }),
    [debouncedSearch, roleFilter]
  );

  const toggleActive = async (person: Profile) => {
    const next = !person.active;
    try {
      await setAccountActive(person.id, next);
      toast({
        title: next ? "Account activated" : "Account deactivated",
        description: next ? "They can log in again." : "They're logged out and can't log in until you reactivate them.",
      });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't update account",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Manage Accounts"
        description="Everyone who signed up for RedAid. New accounts start as Charters; use the role menu to make someone a Team Leader."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          className="sm:max-w-sm"
        />
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="team_leader">Team Leader</SelectItem>
            <SelectItem value="charter">Charter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!users && loading ? (
        <LoadingState />
      ) : !users ? (
        <EmptyState title="Couldn't load accounts" description={error ?? "Please try again."} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={RotateCw}
          title="No accounts found"
          description="Try a different search. People appear here after they sign up and confirm their email."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {users.map((person, index) => (
            <div
              key={person.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40",
                index > 0 && "border-t border-border/70"
              )}
            >
              <button
                type="button"
                onClick={() => router.push(`/admin/accounts/${person.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <UserAvatar uri={person.photo_url} name={person.full_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {person.full_name || "Unnamed"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                </span>
              </button>
              <RoleSelect person={person} onChanged={() => load()} />
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {person.active ? "Active" : "Inactive"}
                </span>
                <Switch
                  checked={person.active}
                  onCheckedChange={() => toggleActive(person)}
                  // You can't deactivate yourself (the server refuses it too).
                  disabled={person.id === user?.id}
                  aria-label={person.id === user?.id ? "Your account (can't deactivate yourself)" : "Active account"}
                />
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

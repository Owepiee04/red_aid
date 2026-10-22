"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import AddAccountDialog from "@/components/AddAccountDialog";
import { useData } from "@/lib/useData";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { listStaff, setAccountActive } from "@/lib/data/profiles";
import type { DutyRole } from "@/types/auth";
import type { Profile } from "@/types/domain";

type RoleFilter = "all" | DutyRole;

export default function ManageAccountsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
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
      toast({ title: next ? "Account activated" : "Account deactivated" });
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
        description="Team Leaders and Charters in RedAid."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </Button>
        }
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
          description="Try a different search, or add a new Team Leader or Charter."
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
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-flex",
                    person.duty_role === "team_leader"
                      ? "border-primary/20 bg-accent text-accent-foreground"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {person.duty_role ? ROLE_LABEL[person.duty_role] : "Pending"}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {person.active ? "Active" : "Inactive"}
                </span>
                <Switch
                  checked={person.active}
                  onCheckedChange={() => toggleActive(person)}
                  aria-label="Active account"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
    </div>
  );
}

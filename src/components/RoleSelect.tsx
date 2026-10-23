"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { setDutyRole } from "@/lib/data/profiles";
import type { DutyRole } from "@/types/auth";
import type { Profile } from "@/types/domain";

const DUTY_ROLES: DutyRole[] = ["charter", "team_leader"];

const WHAT_CHANGES: Record<DutyRole, string> = {
  team_leader: "They'll get the Team Leader dashboard: verifying Charters, reviewing reports and ending duties.",
  charter: "They'll get the Charter pages: charting patient reports once a Team Leader verifies them on duty.",
};

interface RoleSelectProps {
  person: Pick<Profile, "id" | "full_name" | "role" | "duty_role">;
  /** Called after the role was saved, e.g. to reload the list. */
  onChanged?: (role: DutyRole) => void;
  className?: string;
}

/**
 * Lets an Admin switch someone between Charter and Team Leader, with a
 * confirmation first. Admin accounts show a fixed "Admin" badge instead:
 * making or removing Admins is done in the database.
 */
export default function RoleSelect({ person, onChanged, className }: RoleSelectProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<DutyRole | null>(null);
  const [saving, setSaving] = useState(false);
  const name = person.full_name || "this person";

  if (person.role === "admin") {
    return (
      <span
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/20 bg-accent px-3 text-xs font-medium text-accent-foreground",
          className
        )}
        title="Admins are managed in the database"
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Admin
      </span>
    );
  }

  const current = person.duty_role ?? undefined;

  const save = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await setDutyRole(person.id, pending);
      toast({ title: "Role updated", description: `${name} is now a ${ROLE_LABEL[pending]}.` });
      setPending(null);
      onChanged?.(pending);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't change the role",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Select
        value={current}
        onValueChange={(value) => {
          if (value !== current) setPending(value as DutyRole);
        }}
        disabled={saving}
      >
        <SelectTrigger className={cn("h-9 w-[8.5rem] shrink-0 text-xs", className)} aria-label={`Role for ${name}`}>
          <SelectValue placeholder="Set role" />
        </SelectTrigger>
        <SelectContent>
          {DUTY_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABEL[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !saving && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make {name} a {pending ? ROLE_LABEL[pending] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? WHAT_CHANGES[pending] : ""} They’ll see the change the next time they open or refresh RedAid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                save();
              }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Change role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

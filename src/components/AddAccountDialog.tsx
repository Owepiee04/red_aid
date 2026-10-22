"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { createAccount } from "@/lib/data/accounts";
import type { DutyRole } from "@/types/auth";

interface FormState {
  name: string;
  email: string;
  dutyRole: DutyRole;
  password: string;
}

const EMPTY: FormState = { name: "", email: "", dutyRole: "charter", password: "" };

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function AddAccountDialog({ open, onOpenChange, onCreated }: AddAccountDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const passwordValid = form.password === "" || form.password.length >= 8;
  const roleLabel = form.dutyRole === "team_leader" ? "Team Leader" : "Charter";

  const submit = async () => {
    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }
    if (!passwordValid) {
      setError("A temporary password must be at least 8 characters.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { invited } = await createAccount({
        name: form.name.trim(),
        email: form.email.trim(),
        dutyRole: form.dutyRole,
        password: form.password || undefined,
      });
      toast({
        title: invited ? "Invite sent" : "Account created",
        description: invited
          ? `${form.email.trim()} will get an email to set their password, as a ${roleLabel}.`
          : `${form.email.trim()} can log in now as a ${roleLabel} with the temporary password.`,
      });
      setForm(EMPTY);
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new account</DialogTitle>
          <DialogDescription>
            They&apos;ll get an invite email to set their own password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.dutyRole} onValueChange={(value) => set("dutyRole", value as DutyRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="charter">Charter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-password">Temporary password (optional)</Label>
            <Input
              id="account-password"
              type="text"
              autoComplete="off"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Leave blank to email an invite instead"
            />
            <p className="text-xs text-muted-foreground">
              Setting one skips the email — handy when inviting many people at once. Give it to them
              yourself and ask them to change it.
            </p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={busy || !form.email.trim()}>
            {busy ? "Creating…" : form.password ? "Create Account" : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

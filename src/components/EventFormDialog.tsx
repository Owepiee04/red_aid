"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import PersonPicker from "@/components/PersonPicker";
import { useData } from "@/lib/useData";
import { listStaff } from "@/lib/data/profiles";
import { deleteEvent, saveEvent } from "@/lib/data/events";
import type { EventDetail } from "@/types/domain";

interface FormState {
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  teamLeaderIds: string[];
  charterIds: string[];
}

const EMPTY: FormState = {
  title: "",
  date: "",
  time: "",
  location: "",
  description: "",
  teamLeaderIds: [],
  charterIds: [],
};

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an event to edit it; leave out to create a new one. */
  event?: EventDetail | null;
  onSaved?: () => void;
  /** Called after a successful delete (e.g. to leave the now-empty detail page). */
  onDeleted?: () => void;
}

export default function EventFormDialog({ open, onOpenChange, event, onSaved, onDeleted }: EventFormDialogProps) {
  const { toast } = useToast();
  const isEdit = Boolean(event?.id);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Only fetch the people list while the dialog is actually open.
  const { data: staff, error: staffError } = useData(() => (open ? listStaff() : Promise.resolve([])), [open]);

  useEffect(() => {
    if (!open) return;
    setForm(
      event
        ? {
            title: event.title,
            date: event.date,
            time: event.time?.slice(0, 5) ?? "", // "09:00:00" -> "09:00" for the time input
            location: event.location ?? "",
            description: event.description ?? "",
            teamLeaderIds: event.team_leaders.map((p) => p.user_id),
            charterIds: event.charters.map((p) => p.user_id),
          }
        : EMPTY
    );
  }, [open, event]);

  // Deactivated accounts can't be newly assigned, but stay visible if already on this event.
  const selected = new Set([...form.teamLeaderIds, ...form.charterIds]);
  const assignable = (staff ?? []).filter((person) => person.active || selected.has(person.id));
  const teamLeaders = assignable.filter((person) => person.duty_role === "team_leader");
  const charters = assignable.filter((person) => person.duty_role === "charter");

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggle = (field: "teamLeaderIds" | "charterIds", id: string) =>
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));

  const complete =
    form.title.trim() !== "" &&
    form.date !== "" &&
    form.time !== "" &&
    form.location.trim() !== "" &&
    form.teamLeaderIds.length > 0;

  const save = async () => {
    setBusy(true);
    try {
      await saveEvent({
        id: event?.id,
        title: form.title.trim(),
        date: form.date,
        time: form.time,
        location: form.location.trim(),
        description: form.description.trim(),
        teamLeaderIds: form.teamLeaderIds,
        charterIds: form.charterIds,
      });
      toast({ title: isEdit ? "Event updated" : "Event created" });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't save the event",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!event) return;
    setBusy(true);
    try {
      await deleteEvent(event.id);
      toast({ title: "Event deleted" });
      setConfirmDelete(false);
      onOpenChange(false);
      // After a delete the caller usually leaves the page; only refresh if it doesn't.
      if (onDeleted) onDeleted();
      else onSaved?.();
    } catch (e) {
      setConfirmDelete(false);
      toast({
        variant: "destructive",
        title: "Couldn't delete the event",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>
              Set the duty details and assign the team who will be on duty.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Intramurals Day 1"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time">Time</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-location">Location</Label>
                <Input
                  id="event-location"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. Covered Court"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Description (optional)</Label>
              <Textarea
                id="event-description"
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Anything the duty team should know"
              />
            </div>

            {staffError && (
              <p className="text-xs text-destructive">Couldn&apos;t load the list of people: {staffError}</p>
            )}

            <div className="space-y-2 border-t border-border/70 pt-5">
              <Label>Assign Team Leader(s)</Label>
              <p className="text-xs text-muted-foreground">
                At least one team leader is required. They verify charters on the day.
              </p>
              <PersonPicker
                people={teamLeaders}
                selectedIds={form.teamLeaderIds}
                onToggle={(id) => toggle("teamLeaderIds", id)}
                placeholder="Search team leaders"
              />
            </div>

            <div className="space-y-2 border-t border-border/70 pt-5">
              <Label>Assign Charters</Label>
              <PersonPicker
                people={charters}
                selectedIds={form.charterIds}
                onToggle={(id) => toggle("charterIds", id)}
                placeholder="Search charters"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Event
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              {!complete && (
                <p className="text-xs text-muted-foreground">
                  Add a title, date, time, location and at least one team leader.
                </p>
              )}
              <Button type="button" onClick={save} disabled={!complete || busy}>
                {busy ? "Saving…" : "Save Event"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Events that already have patient reports can&apos;t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open until the delete finishes
                void remove();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Loader2, LogOut, Trash2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABEL, roleOf } from "@/lib/roles";
import { uploadAvatar } from "@/lib/storage";
import { checkConnection } from "@/lib/connectivity";
import { getCachedUserProfile } from "@/lib/indexed-db/userProfile";
import type { CachedUserProfile } from "@/lib/indexed-db/types";
import { MIN_PASSWORD_LENGTH, changePassword, updateMyProfile } from "@/lib/data/me";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

/** The Settings page every role shares: profile (name, photo), password, log out. */
export default function SettingsView() {
  const { user, refreshUser, logout } = useAuth();
  const { toast } = useToast();
  const role = roleOf(user);

  // ----------------------------------------------------------- Profile
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [cachedProfile, setCachedProfile] = useState<CachedUserProfile | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const offline = online === false;

  useEffect(() => {
    setFullName(user?.full_name ?? "");
  }, [user?.full_name]);

  useEffect(() => {
    let cancelled = false;

    const apply = (reachable: boolean) => {
      if (!cancelled) setOnline(reachable);
    };

    const refresh = async () => {
      apply(await checkConnection());
    };

    void refresh();
    const onOnline = () => void refresh();
    const onOffline = () => apply(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setCachedProfile(null);
      return;
    }

    getCachedUserProfile(user.id)
      .then((profile) => {
        if (!cancelled) setCachedProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setCachedProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) return null;

  const reloadCachedProfile = async () => {
    try {
      setCachedProfile(await getCachedUserProfile(user.id));
    } catch {
      setCachedProfile(null);
    }
  };

  const nameChanged = fullName.trim() !== (user.full_name ?? "").trim();

  const saveName = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (offline) return;
    setSavingName(true);
    try {
      await updateMyProfile(fullName, user.photo_url ?? null);
      await refreshUser();
      await reloadCachedProfile();
      toast({ title: "Name updated" });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't save your name", description: errorText(err) });
    } finally {
      setSavingName(false);
    }
  };

  const changePhoto = async (file: File | undefined) => {
    if (!file || offline) return;
    setPhotoBusy(true);
    try {
      const path = await uploadAvatar(user.id, file);
      await updateMyProfile(user.full_name || fullName, path);
      await refreshUser();
      await reloadCachedProfile();
      toast({ title: "Photo updated" });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't update your photo", description: errorText(err) });
    } finally {
      setPhotoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removePhoto = async () => {
    if (offline) return;
    setPhotoBusy(true);
    try {
      await updateMyProfile(user.full_name || fullName, null);
      await refreshUser();
      await reloadCachedProfile();
      toast({ title: "Photo removed" });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't remove your photo", description: errorText(err) });
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Your profile, password, and sign-out." />

      {offline && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">You&apos;re offline — settings are read-only.</p>
            <p className="mt-1 text-amber-800">
              Profile and password changes are disabled until you&apos;re back online.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Profile" subtitle="How your name and photo appear to your team.">
          <div className="flex items-center gap-4">
            <UserAvatar
              uri={offline ? null : user.photo_url}
              blob={offline ? cachedProfile?.photoBlob : null}
              name={user.full_name || user.email}
              className="h-20 w-20"
              textClassName="text-2xl"
            />
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={offline}
                onChange={(e) => changePhoto(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={photoBusy || offline}
                onClick={() => fileInput.current?.click()}
              >
                {photoBusy ? <Loader2 className="animate-spin" /> : <Camera />}
                {user.photo_url ? "Change photo" : "Add photo"}
              </Button>
              {user.photo_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={photoBusy || offline}
                  onClick={removePhoto}
                >
                  <Trash2 />
                  Remove
                </Button>
              )}
            </div>
          </div>

          <form onSubmit={saveName} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Full name</Label>
              <Input
                id="settings-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
                autoComplete="name"
                disabled={offline}
                required
              />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="mt-0.5 break-all font-medium">{user.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="mt-0.5 font-medium">{role ? ROLE_LABEL[role] : "Not assigned"}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Your email and role can only be changed by an Admin.
            </p>
            <Button type="submit" disabled={offline || !nameChanged || !fullName.trim() || savingName}>
              {savingName && <Loader2 className="animate-spin" />}
              Save name
            </Button>
          </form>
        </SectionCard>

        <div className="space-y-6">
          <PasswordCard email={user.email} offline={offline} />

          <SectionCard title="Sign out" subtitle="Log out of RedAid on this device.">
            <Button type="button" variant="outline" onClick={() => logout()}>
              <LogOut />
              Log out
            </Button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function PasswordCard({ email, offline }: { email: string; offline: boolean }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (offline) return;
    setError("");
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(email, current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ title: "Password changed" });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Password" subtitle={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Current password</Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={offline}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">New password</Label>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={offline}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={offline}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={offline || busy || !current || !next || !confirm}>
          {busy && <Loader2 className="animate-spin" />}
          Change password
        </Button>
      </form>
    </SectionCard>
  );
}

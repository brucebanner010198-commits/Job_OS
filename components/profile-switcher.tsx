"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PROFILE_STORAGE_KEY } from "@/lib/profiles/constants";
import {
  createProfileAction,
  deleteProfileAction,
  switchProfileAction,
  type ProfileSummary,
} from "@/app/actions/profiles";

type Props = {
  profiles: ProfileSummary[];
  activeProfile: ProfileSummary;
};

export function ProfileSwitcher({ profiles, activeProfile }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, activeProfile.id);
    } catch {
      /* ignore */
    }
  }, [activeProfile.id]);

  function handleSwitch(profileId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await switchProfileAction(profileId);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to switch profile.");
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createProfileAction(newName);
        setNewName("");
        setCreating(false);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create profile.");
      }
    });
  }

  function handleDelete(profileId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteProfileAction(profileId);
        setConfirmDeleteId(null);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete profile.");
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
          pending && "opacity-60",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {activeProfile.name}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close profile menu"
            onClick={() => {
              setOpen(false);
              setCreating(false);
              setConfirmDeleteId(null);
            }}
          />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-2 shadow-lg">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Profiles
            </p>
            <ul className="max-h-48 overflow-y-auto" role="listbox">
              {profiles.map((p) => (
                <li key={p.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    role="option"
                    aria-selected={p.id === activeProfile.id}
                    onClick={() => handleSwitch(p.id)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                      p.id === activeProfile.id && "bg-muted font-medium",
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                  </button>
                  {profiles.length > 1 && (
                    <button
                      type="button"
                      title={`Delete ${p.name}`}
                      onClick={() =>
                        setConfirmDeleteId(
                          confirmDeleteId === p.id ? null : p.id,
                        )
                      }
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {confirmDeleteId && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                <p className="mb-2 text-foreground">
                  Delete this profile and all its career data? This cannot be
                  undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-7 flex-1 bg-destructive text-destructive-foreground hover:opacity-90"
                    disabled={pending}
                    onClick={() => handleDelete(confirmDeleteId)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}

            {creating ? (
              <form onSubmit={handleCreate} className="mt-2 space-y-2 border-t border-border pt-2">
                <Input
                  autoFocus
                  placeholder="Profile name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={64}
                  disabled={pending}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1"
                    disabled={pending || !newName.trim()}
                  >
                    Create
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Create profile
              </button>
            )}

            {error && (
              <p className="mt-2 px-1 text-xs text-destructive">{error}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

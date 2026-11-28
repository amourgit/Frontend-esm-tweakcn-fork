"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateThemeVersion, useRestoreThemeRevision, useThemeRevisions } from "@/hooks/themes";
import { useEditorStore } from "@/store/editor-store";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { authorLabel, formatDateTime, ORIGIN_LABEL } from "./labels";
import { useOpenRevisionInEditor } from "./use-open-revision";

interface RevisionListProps {
  themeId: string;
  /** L'utilisateur est propriétaire : il peut restaurer un état et poser des versions. */
  canWrite: boolean;
  onClose: () => void;
}

/** Tous les états du thème, du plus récent au plus ancien. */
export function RevisionList({ themeId, canWrite, onClose }: RevisionListProps) {
  const { data: revisions, isLoading, error } = useThemeRevisions(themeId);
  const restore = useRestoreThemeRevision();
  const createVersion = useCreateThemeVersion();
  const applyThemePreset = useEditorStore((s) => s.applyThemePreset);
  const { open, opening } = useOpenRevisionInEditor(themeId, onClose);
  const [versioning, setVersioning] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const head = revisions?.[0]?.revision;

  const restoreRevision = async (revision: number) => {
    try {
      await restore.mutateAsync({ themeId, revision });
      applyThemePreset(themeId);
      onClose();
    } catch {
      /* message déjà affiché par le hook */
    }
  };

  const confirmVersion = async (revision: number) => {
    try {
      await createVersion.mutateAsync({ themeId, revision, notes: notes.trim() || null });
      setVersioning(null);
      setNotes("");
    } catch {
      /* message déjà affiché par le hook */
    }
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading states…
      </div>
    );
  }
  if (error) return <p className="text-destructive py-4 text-sm">Could not load the states.</p>;

  return (
    <ul className="space-y-2">
      {revisions?.map((r) => (
        <li key={r.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-semibold">State {r.revision}</span>
              <Badge variant="secondary">{ORIGIN_LABEL[r.origin] ?? r.origin}</Badge>
              {r.version !== null && <Badge>v{r.version}</Badge>}
              {r.revision === head && <Badge variant="outline">Current</Badge>}
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(r.createdAt)}</span>
          </div>
          <p className="mt-1 truncate font-medium">{r.name}</p>
          {r.message && <p className="mt-0.5 text-xs italic">{r.message}</p>}
          <p className="text-muted-foreground mt-1 text-xs">{authorLabel(r.createdByName)}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={opening !== null}
              onClick={() => open(r.revision)}
            >
              {opening === r.revision ? <Loader2 className="size-3.5 animate-spin" /> : "Open in editor"}
            </Button>
            {canWrite && r.revision !== head && (
              <Button
                size="sm"
                variant="ghost"
                disabled={restore.isPending}
                onClick={() => restoreRevision(r.revision)}
              >
                Restore
              </Button>
            )}
            {canWrite && r.version === null && versioning !== r.revision && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setVersioning(r.revision);
                  setNotes("");
                }}
              >
                Create version
              </Button>
            )}
          </div>

          {canWrite && versioning === r.revision && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                autoFocus
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Version notes (optional)"
                className="h-8 text-xs"
              />
              <Button size="sm" disabled={createVersion.isPending} onClick={() => confirmVersion(r.revision)}>
                {createVersion.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setVersioning(null)}>
                Cancel
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

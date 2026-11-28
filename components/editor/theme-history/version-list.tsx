"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRestoreThemeRevision, useThemeVersions } from "@/hooks/themes";
import { useEditorStore } from "@/store/editor-store";
import { Loader2 } from "lucide-react";
import { authorLabel, formatDateTime } from "./labels";
import { useOpenRevisionInEditor } from "./use-open-revision";

interface VersionListProps {
  themeId: string;
  canWrite: boolean;
  /** État courant du thème, pour ne pas proposer de « restaurer » ce qui l'est déjà. */
  currentRevision: number | undefined;
  onClose: () => void;
}

/** Versions du thème : étiquettes posées sur un état précis. */
export function VersionList({ themeId, canWrite, currentRevision, onClose }: VersionListProps) {
  const { data: versions, isLoading, error } = useThemeVersions(themeId);
  const restore = useRestoreThemeRevision();
  const applyThemePreset = useEditorStore((s) => s.applyThemePreset);
  const { open, opening } = useOpenRevisionInEditor(themeId, onClose);

  const restoreRevision = async (revision: number) => {
    try {
      await restore.mutateAsync({ themeId, revision });
      applyThemePreset(themeId);
      onClose();
    } catch {
      /* message déjà affiché par le hook */
    }
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading versions…
      </div>
    );
  }
  if (error) return <p className="text-destructive py-4 text-sm">Could not load the versions.</p>;
  if (!versions?.length) {
    return <p className="text-muted-foreground py-4 text-sm">No version yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {versions.map((v, index) => (
        <li key={v.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-semibold">Version {v.version}</span>
              <Badge variant="secondary">State {v.revision}</Badge>
              {index === 0 && <Badge variant="outline">Latest</Badge>}
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(v.createdAt)}</span>
          </div>
          {v.notes && <p className="mt-1 text-xs italic">{v.notes}</p>}
          <p className="text-muted-foreground mt-1 text-xs">{authorLabel(v.createdByName)}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={opening !== null}
              onClick={() => open(v.revision)}
            >
              {opening === v.revision ? <Loader2 className="size-3.5 animate-spin" /> : "Open in editor"}
            </Button>
            {canWrite && v.revision !== currentRevision && (
              <Button
                size="sm"
                variant="ghost"
                disabled={restore.isPending}
                onClick={() => restoreRevision(v.revision)}
              >
                Restore
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { getThemeVersion } from "@/actions/themes";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRestoreThemeVersion, useThemeVersions } from "@/hooks/themes";
import { useEditorStore } from "@/store/editor-store";
import { useThemePresetStore } from "@/store/theme-preset-store";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "../ui/revola";

const ORIGIN_LABEL: Record<string, string> = {
  SEED: "Initial import",
  CREATE: "Created",
  UPDATE: "Edited",
  RESTORE: "Restored",
};

interface ThemeHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeId: string | undefined;
}

/**
 * Historique des versions d'un thème persisté : consulter, ouvrir une version dans l'éditeur
 * (sans l'enregistrer) ou la restaurer (crée une nouvelle version, l'historique n'est jamais réécrit).
 */
export function ThemeHistoryDialog({ open, onOpenChange, themeId }: ThemeHistoryDialogProps) {
  const { data: versions, isLoading, error } = useThemeVersions(themeId ?? null, open);
  const restore = useRestoreThemeVersion();
  const applyThemePreset = useEditorStore((s) => s.applyThemePreset);
  const setThemeState = useEditorStore((s) => s.setThemeState);
  const presetLabel = useThemePresetStore((s) => (themeId ? s.presets[themeId]?.label : undefined));
  const currentVersion = useThemePresetStore((s) => (themeId ? s.presets[themeId]?.version : undefined));
  const [openingVersion, setOpeningVersion] = useState<number | null>(null);

  const openInEditor = async (version: number) => {
    if (!themeId) return;
    setOpeningVersion(version);
    try {
      const row = await getThemeVersion(themeId, version);
      const prev = useEditorStore.getState().themeState;
      setThemeState({ ...prev, styles: row.styles });
      onOpenChange(false);
      toast({
        title: `Version ${version} opened`,
        description: "Save to keep it as a new version, or reset to go back.",
      });
    } catch {
      toast({ title: "Could not open this version", variant: "destructive" });
    } finally {
      setOpeningVersion(null);
    }
  };

  const restoreVersion = async (version: number) => {
    if (!themeId) return;
    try {
      await restore.mutateAsync({ themeId, version });
      applyThemePreset(themeId);
      onOpenChange(false);
    } catch {
      /* toast déjà affiché par le hook */
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="overflow-hidden shadow-lg sm:max-w-xl">
        <div className="space-y-4 p-6 pt-0 sm:pt-6">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Version history</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {presetLabel ? `“${presetLabel}” — ` : ""}every save is kept. Restoring a version
              creates a new one.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {isLoading && (
            <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading versions…
            </div>
          )}
          {error && <p className="text-destructive text-sm">Could not load the history.</p>}

          <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {versions?.map((v) => {
              const isCurrent = v.version === currentVersion;
              return (
                <li key={v.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold">v{v.version}</span>
                      <Badge variant="secondary">{ORIGIN_LABEL[v.origin] ?? v.origin}</Badge>
                      {isCurrent && <Badge>Current</Badge>}
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-medium">{v.name}</p>
                  {v.description && <p className="text-muted-foreground text-xs">{v.description}</p>}
                  {v.changeNote && <p className="mt-1 text-xs italic">{v.changeNote}</p>}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {v.createdByName ? `by ${v.createdByName}` : "by the studio"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={openingVersion !== null}
                      onClick={() => openInEditor(v.version)}
                    >
                      {openingVersion === v.version ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        "Open in editor"
                      )}
                    </Button>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={restore.isPending}
                        onClick={() => restoreVersion(v.version)}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

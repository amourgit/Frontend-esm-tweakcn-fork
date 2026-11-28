"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useThemePresetStore } from "@/store/theme-preset-store";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "../../ui/revola";
import { RevisionList } from "./revision-list";
import { VersionList } from "./version-list";

interface ThemeHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeId: string | undefined;
}

/**
 * Historique d'un thème persisté, comme sur GitHub :
 *  - « States » : chaque enregistrement (commit) ; on peut en ouvrir un, le restaurer ou y poser une version ;
 *  - « Versions » : les étiquettes posées sur des états précis.
 * Seul le propriétaire peut restaurer ou créer des versions ; les thèmes système sont en lecture seule.
 */
export function ThemeHistoryDialog({ open, onOpenChange, themeId }: ThemeHistoryDialogProps) {
  const preset = useThemePresetStore((s) => (themeId ? s.presets[themeId] : undefined));
  const canWrite = preset?.source === "SAVED";
  const close = () => onOpenChange(false);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="overflow-hidden shadow-lg sm:max-w-xl">
        <div className="space-y-4 p-6 pt-0 sm:pt-6">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>History</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {preset?.label ? `“${preset.label}” — ` : ""}
              {canWrite
                ? "every save is a state; a version marks one state worth keeping."
                : "system theme: read-only. Save a copy to make it yours."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {open && themeId && (
            <Tabs defaultValue="states">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="states">States</TabsTrigger>
                <TabsTrigger value="versions">Versions</TabsTrigger>
              </TabsList>
              <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1">
                <TabsContent value="states">
                  <RevisionList themeId={themeId} canWrite={canWrite} onClose={close} />
                </TabsContent>
                <TabsContent value="versions">
                  <VersionList
                    themeId={themeId}
                    canWrite={canWrite}
                    currentRevision={preset?.revision}
                    onClose={close}
                  />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

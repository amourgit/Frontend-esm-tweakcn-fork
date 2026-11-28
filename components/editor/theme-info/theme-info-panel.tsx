"use client";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useThemeDetails } from "@/hooks/themes";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import { useThemePresetStore } from "@/store/theme-preset-store";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { buildThemeInfoRows, describeVersion } from "./rows";

/**
 * Section « Theme details » : fiche d'identité du thème choisi (version, état, auteur, dates,
 * provenance, métadonnées). Elle décrit la dernière version ENREGISTRÉE en base ; les modifications
 * en cours dans l'éditeur sont signalées mais ne changent pas la fiche.
 */
export function ThemeInfoPanel({ className }: { className?: string }) {
  const presetId = useEditorStore((s) => s.themeState.preset);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges);
  const persistedId = useThemePresetStore((s) => {
    const source = presetId ? s.presets[presetId]?.source : undefined;
    return source === "SAVED" || source === "BUILT_IN" ? presetId : undefined;
  });
  const { data: details, isLoading, isError } = useThemeDetails(persistedId);
  const [open, setOpen] = useState(false);

  if (!persistedId) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("border-b", className)}>
      <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between gap-2 px-4 py-2 text-xs transition-colors">
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-medium">Theme details</span>
          {details && (
            <span className="text-muted-foreground truncate">
              {describeVersion(details)} · state {details.currentRevision}
            </span>
          )}
          {hasUnsavedChanges() && <Badge variant="outline">Unsaved changes</Badge>}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="max-h-64 space-y-3 overflow-y-auto px-4 pt-1 pb-3 text-xs">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {isError && <p className="text-destructive">Could not load the theme details.</p>}
          {details && (
            <>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5">
                {buildThemeInfoRows(details).map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {Object.keys(details.metadata).length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Metadata</p>
                  <pre className="bg-muted overflow-x-auto rounded-md p-2 text-[11px] leading-snug">
                    {JSON.stringify(details.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "../ui/revola";

const formSchema = z.object({
  themeName: z.string().trim().min(1, "Theme name cannot be empty.").max(50, "Theme name too long."),
  description: z.string().max(500, "Description too long."),
  changeNote: z.string().max(500, "Change note too long."),
});

/** Métadonnées saisies pour la version enregistrée. */
export interface ThemeSaveValues {
  name: string;
  description: string | null;
  changeNote: string | null;
}

type SaveMode = "version" | "new";

interface ThemeSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ThemeSaveValues) => Promise<void>;
  isSaving: boolean;
  initialThemeName?: string;
  ctaLabel?: string;
  title?: string;
  description?: string;
  /** Thème persisté en cours de modification : propose d'en enregistrer une nouvelle version. */
  existingThemeName?: string;
  existingThemeDescription?: string | null;
  existingVersion?: number;
  onUpdateExisting?: (values: ThemeSaveValues) => Promise<void>;
  isUpdating?: boolean;
}

export function ThemeSaveDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
  initialThemeName = "",
  ctaLabel = "Save Theme",
  title = "Save Theme",
  description = "Enter a name for your theme so you can find it later.",
  existingThemeName,
  existingThemeDescription,
  existingVersion,
  onUpdateExisting,
  isUpdating = false,
}: ThemeSaveDialogProps) {
  const hasUpdateOption = !!existingThemeName && !!onUpdateExisting;
  const [mode, setMode] = useState<SaveMode>(hasUpdateOption ? "version" : "new");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { themeName: initialThemeName, description: "", changeNote: "" },
  });

  const resetFor = (nextMode: SaveMode) => {
    form.reset(
      nextMode === "version"
        ? {
            themeName: existingThemeName ?? "",
            description: existingThemeDescription ?? "",
            changeNote: "",
          }
        : { themeName: initialThemeName, description: "", changeNote: "" }
    );
  };

  useEffect(() => {
    if (open) {
      const initialMode: SaveMode = hasUpdateOption ? "version" : "new";
      setMode(initialMode);
      resetFor(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialThemeName, existingThemeName, existingThemeDescription, hasUpdateOption]);

  const switchMode = (nextMode: SaveMode) => {
    setMode(nextMode);
    resetFor(nextMode);
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const payload: ThemeSaveValues = {
      name: values.themeName.trim(),
      description: values.description.trim() || null,
      changeNote: mode === "version" ? values.changeNote.trim() || null : null,
    };
    if (mode === "version" && onUpdateExisting) onUpdateExisting(payload);
    else onSave(payload);
  };

  const busy = isSaving || isUpdating;
  const submitLabel = mode === "version" ? "Save new version" : ctaLabel;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="overflow-hidden shadow-lg sm:max-w-110">
        <div className="space-y-6 p-6 pt-0 sm:pt-6 sm:pb-2">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {mode === "version"
                ? "Each save adds a new version; previous versions are kept and can be restored."
                : description}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {hasUpdateOption && (
            <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1" role="tablist">
              {(
                [
                  ["version", `New version of “${existingThemeName}”`],
                  ["new", "Save as a new theme"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  disabled={busy}
                  onClick={() => switchMode(value)}
                  className={cn(
                    "truncate rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    mode === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="themeName"
                render={({ field }) => (
                  <FormItem className="grid">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome Theme" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="grid">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="What is this theme for? (optional)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {mode === "version" && (
                <FormField
                  control={form.control}
                  name="changeNote"
                  render={({ field }) => (
                    <FormItem className="grid">
                      <FormLabel>
                        What changed?
                        {existingVersion ? (
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            v{existingVersion} → v{existingVersion + 1}
                          </span>
                        ) : null}
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Darker sidebar, new brand blue" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </form>
          </Form>
        </div>
        <ResponsiveDialogFooter className="bg-muted/30 border-t px-6 py-4">
          <Button size="sm" disabled={busy} variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={busy || !form.formState.isValid || form.formState.isSubmitting}
            onClick={form.handleSubmit(onSubmit)}
          >
            {busy || form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" />
                Saving
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

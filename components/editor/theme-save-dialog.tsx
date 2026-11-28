"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  message: z.string().max(500, "Message too long."),
  createVersion: z.boolean(),
  versionNotes: z.string().max(500, "Notes too long."),
});

/** Ce que l'utilisateur saisit à l'enregistrement. */
export interface ThemeSaveValues {
  name: string;
  description: string | null;
  /** Message de l'état (comme un message de commit). */
  message: string | null;
  /** Renseigné quand l'utilisateur demande aussi une version sur cet état. */
  release: { notes: string | null } | null;
}

/** Thème de l'utilisateur en cours de modification (on peut y enregistrer un nouvel état). */
export interface ExistingThemeInfo {
  name: string;
  description: string | null;
  /** État courant du thème : sert à détecter une modification concurrente. */
  revision?: number;
  /** Dernière version publiée, s'il y en a une. */
  version: number | null;
}

type SaveMode = "state" | "new";

interface ThemeSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Crée un nouveau thème (copie dérivée du thème affiché, le cas échéant). */
  onSave: (values: ThemeSaveValues) => Promise<void>;
  isSaving: boolean;
  initialThemeName?: string;
  ctaLabel?: string;
  title?: string;
  description?: string;
  existingTheme?: ExistingThemeInfo;
  /** Nom du thème dont la copie dérive (thème système ou thème de l'utilisateur). */
  derivedFromName?: string;
  /** Enregistre un nouvel état du thème existant, avec ou sans version. */
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
  existingTheme,
  derivedFromName,
  onUpdateExisting,
  isUpdating = false,
}: ThemeSaveDialogProps) {
  const hasUpdateOption = !!existingTheme && !!onUpdateExisting;
  const [mode, setMode] = useState<SaveMode>(hasUpdateOption ? "state" : "new");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      themeName: initialThemeName,
      description: "",
      message: "",
      createVersion: false,
      versionNotes: "",
    },
  });
  const createVersion = form.watch("createVersion");

  const resetFor = (nextMode: SaveMode) => {
    form.reset({
      themeName: nextMode === "state" ? (existingTheme?.name ?? "") : initialThemeName,
      description: nextMode === "state" ? (existingTheme?.description ?? "") : "",
      message: "",
      createVersion: false,
      versionNotes: "",
    });
  };

  useEffect(() => {
    if (open) {
      const initialMode: SaveMode = hasUpdateOption ? "state" : "new";
      setMode(initialMode);
      resetFor(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialThemeName, existingTheme?.name, existingTheme?.description, hasUpdateOption]);

  const switchMode = (nextMode: SaveMode) => {
    setMode(nextMode);
    resetFor(nextMode);
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const payload: ThemeSaveValues = {
      name: values.themeName.trim(),
      description: values.description.trim() || null,
      message: values.message.trim() || null,
      release:
        mode === "state" && values.createVersion
          ? { notes: values.versionNotes.trim() || null }
          : null,
    };
    if (mode === "state" && onUpdateExisting) onUpdateExisting(payload);
    else onSave(payload);
  };

  const busy = isSaving || isUpdating;
  const nextVersion = (existingTheme?.version ?? 0) + 1;
  const submitLabel =
    mode === "state" ? (createVersion ? `Save state & create v${nextVersion}` : "Save state") : ctaLabel;

  const intro =
    mode === "state"
      ? "A state is saved in this theme's history. Create a version only when this state is worth marking."
      : derivedFromName
        ? `This creates your own theme, derived from “${derivedFromName}”. The original is not modified.`
        : description;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="overflow-hidden shadow-lg sm:max-w-110">
        <div className="space-y-6 p-6 pt-0 sm:pt-6 sm:pb-2">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>{intro}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {hasUpdateOption && (
            <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1" role="tablist">
              {(
                [
                  ["state", `Save a state of “${existingTheme?.name}”`],
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
                      <Textarea rows={2} placeholder="What is this theme for? (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {mode === "state" && (
                <>
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem className="grid">
                        <FormLabel>What changed?</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Darker sidebar, new brand blue" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="createVersion"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="cursor-pointer font-normal">
                          Also create version {nextVersion} from this state
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  {createVersion && (
                    <FormField
                      control={form.control}
                      name="versionNotes"
                      render={({ field }) => (
                        <FormItem className="grid">
                          <FormLabel>Version notes</FormLabel>
                          <FormControl>
                            <Input placeholder="Release notes (optional)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
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

import { CodePanelDialog } from "@/components/editor/code-panel-dialog";
import CssImportDialog from "@/components/editor/css-import-dialog";
import { ShareDialog } from "@/components/editor/share-dialog";
import { ThemeSaveDialog, type ThemeSaveValues } from "@/components/editor/theme-save-dialog";
import { ThemeHistoryDialog } from "@/components/editor/theme-history-dialog";
import { toast } from "@/components/ui/use-toast";
import { useCreateTheme, useUpdateTheme } from "@/hooks/themes";
import { usePostLoginAction } from "@/hooks/use-post-login-action";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/store/auth-store";
import { useEditorStore } from "@/store/editor-store";
import { useThemePresetStore } from "@/store/theme-preset-store";
import { getBaseUrl } from "@/lib/site";
import { parseCssInput } from "@/utils/parse-css-input";
import { mergeImportedStyles, parseEgenTokensDocument } from "@/utils/tokens/export-json";
import { deepMerge } from "@/utils/tokens/object-path";
import { createContext, ReactNode, useContext, useState } from "react";

type PendingAction = "share" | null;

// Get contextual copy for the save dialog based on the pending action
function getSaveDialogCopy(pendingAction: PendingAction) {
  switch (pendingAction) {
    case "share":
      return {
        title: "Save to share",
        description: "Save your theme first to share it with others.",
        ctaLabel: "Save & Share",
      };
    default:
      return {};
  }
}

interface DialogActionsContextType {
  // Dialog states
  cssImportOpen: boolean;
  codePanelOpen: boolean;
  saveDialogOpen: boolean;
  shareDialogOpen: boolean;
  shareUrl: string;
  dialogKey: number;
  isCreatingTheme: boolean;
  isUpdatingTheme: boolean;
  pendingAction: PendingAction;
  existingThemeName: string | undefined;
  existingThemeDescription: string | null | undefined;
  existingVersion: number | undefined;
  historyOpen: boolean;
  /** Thème persisté (système ou enregistré) actuellement affiché, dont on peut consulter l'historique. */
  historyThemeId: string | undefined;

  // Dialog actions
  setCssImportOpen: (open: boolean) => void;
  setCodePanelOpen: (open: boolean) => void;
  setSaveDialogOpen: (open: boolean) => void;
  setShareDialogOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;

  // Handler functions
  handleCssImport: (css: string) => void;
  handleSaveClick: (options?: { shareAfterSave?: boolean }) => void;
  handleShareClick: (id?: string) => Promise<void>;
  saveTheme: (values: ThemeSaveValues) => Promise<void>;
  handleUpdateExisting: (values: ThemeSaveValues) => Promise<void>;
}

function useDialogActionsStore(): DialogActionsContextType {
  const [cssImportOpen, setCssImportOpen] = useState(false);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [dialogKey, _setDialogKey] = useState(0);

  const {
    themeState,
    setThemeState,
    applyThemePreset,
    hasThemeChangedFromCheckpoint,
    hasUnsavedChanges,
  } = useEditorStore();
  const { getPreset } = useThemePresetStore();
  const { data: session } = authClient.useSession();
  const { openAuthDialog } = useAuthStore();
  const createThemeMutation = useCreateTheme();
  const updateThemeMutation = useUpdateTheme();

  const currentPreset = themeState?.preset ? getPreset(themeState.preset) : undefined;
  // Un thème persisté (enregistré OU système) modifié peut recevoir une nouvelle version.
  const isPersistedPreset =
    !!currentPreset && (currentPreset.source === "SAVED" || currentPreset.source === "BUILT_IN");
  const isOnEditablePreset = isPersistedPreset && hasUnsavedChanges();
  const existingThemeName = isOnEditablePreset ? currentPreset.label : undefined;
  const existingThemeDescription = isOnEditablePreset ? currentPreset.description : undefined;
  const existingVersion = isOnEditablePreset ? currentPreset.version : undefined;
  const historyThemeId = isPersistedPreset ? themeState.preset : undefined;

  usePostLoginAction("SAVE_THEME", () => {
    setSaveDialogOpen(true);
  });

  usePostLoginAction("SAVE_THEME_FOR_SHARE", () => {
    setSaveDialogOpen(true);
    setPendingAction("share");
  });

  const handleCssImport = (css: string) => {
    // JSON `egen-tokens.json` (export complet ou partiel du squelette) ou CSS (:root / .dark)
    if (css.trim().startsWith("{")) {
      let json: unknown;
      try {
        json = JSON.parse(css);
      } catch {
        toast({ title: "Import failed", description: "The JSON could not be parsed.", variant: "destructive" });
        return;
      }
      const parsed = parseEgenTokensDocument(json);
      if (!parsed.ok) {
        toast({ title: "Import failed", description: parsed.error, variant: "destructive" });
        return;
      }
      setThemeState({
        ...themeState,
        styles: mergeImportedStyles(themeState.styles, parsed.styles),
      });
      toast({
        title: "Tokens imported",
        description: `${parsed.extendedCount} extended colors and ${parsed.tokenCount} tokens customized.`,
      });
      return;
    }

    const { lightColors, darkColors, tokens } = parseCssInput(css);
    const styles = {
      ...themeState.styles,
      light: { ...themeState.styles.light, ...lightColors },
      dark: { ...themeState.styles.dark, ...darkColors },
      ...(tokens ? { tokens: deepMerge(themeState.styles.tokens ?? {}, tokens) } : {}),
    };

    setThemeState({
      ...themeState,
      styles,
    });

    toast({
      title: "CSS imported",
      description: "Your custom CSS has been imported successfully",
    });
  };

  const handleSaveClick = (options?: { shareAfterSave?: boolean }) => {
    if (!session) {
      let action: "SAVE_THEME" | "SAVE_THEME_FOR_SHARE" = "SAVE_THEME";
      if (options?.shareAfterSave) action = "SAVE_THEME_FOR_SHARE";
      openAuthDialog("signin", action);
      return;
    }

    setSaveDialogOpen(true);
    if (options?.shareAfterSave) {
      setPendingAction("share");
    }
  };

  const saveTheme = async (values: ThemeSaveValues) => {
    const themeData = {
      name: values.name,
      description: values.description,
      styles: themeState.styles,
    };

    try {
      const theme = await createThemeMutation.mutateAsync(themeData);
      if (!theme) return;
      applyThemePreset(theme?.id || themeState.preset || "default");
      if (pendingAction === "share") {
        handleShareClick(theme?.id);
        setPendingAction(null);
      }
      setTimeout(() => {
        setSaveDialogOpen(false);
      }, 50);
    } catch (error) {
      console.error("Save operation failed (error likely handled by hook):", error);
    }
  };

  const handleShareClick = async (id?: string) => {
    if (hasThemeChangedFromCheckpoint()) {
      handleSaveClick({ shareAfterSave: true });
      return;
    }

    const presetId = id ?? themeState.preset;
    const currentPreset = presetId ? getPreset(presetId) : undefined;

    if (!currentPreset) {
      setShareUrl(`${getBaseUrl()}/editor/theme`);
      setShareDialogOpen(true);
      return;
    }

    const isSavedPreset = !!currentPreset && currentPreset.source === "SAVED";

    const url = isSavedPreset
      ? `${getBaseUrl()}/themes/${id}`
      : `${getBaseUrl()}/editor/theme?theme=${id}`;

    setShareUrl(url);
    setShareDialogOpen(true);
  };

  const handleUpdateExisting = async (values: ThemeSaveValues) => {
    if (!themeState.preset) return;
    try {
      const result = await updateThemeMutation.mutateAsync({
        id: themeState.preset,
        name: values.name,
        description: values.description,
        changeNote: values.changeNote,
        styles: themeState.styles,
        // Détecte une modification concurrente du même thème depuis un autre onglet/utilisateur.
        baseVersion: existingVersion,
      });
      if (result) {
        applyThemePreset(result.id || themeState.preset);
        setSaveDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to update theme:", error);
    }
  };

  const value = {
    // Dialog states
    cssImportOpen,
    codePanelOpen,
    saveDialogOpen,
    shareDialogOpen,
    shareUrl,
    dialogKey,
    isCreatingTheme: createThemeMutation.isPending,
    isUpdatingTheme: updateThemeMutation.isPending,
    pendingAction,
    existingThemeName,
    existingThemeDescription,
    existingVersion,
    historyOpen,
    historyThemeId,

    // Dialog actions
    setCssImportOpen,
    setCodePanelOpen,
    setSaveDialogOpen,
    setShareDialogOpen,
    setHistoryOpen,

    // Handler functions
    handleCssImport,
    handleSaveClick,
    handleShareClick,
    saveTheme,
    handleUpdateExisting,
  };

  return value;
}

export const DialogActionsContext = createContext<DialogActionsContextType | null>(null);

export function DialogActionsProvider({ children }: { children: ReactNode }) {
  const { themeState } = useEditorStore();
  const store = useDialogActionsStore();

  return (
    <DialogActionsContext value={store}>
      {children}

      {/* Global Dialogs */}
      <CssImportDialog
        open={store.cssImportOpen}
        onOpenChange={store.setCssImportOpen}
        onImport={store.handleCssImport}
      />
      <CodePanelDialog
        open={store.codePanelOpen}
        onOpenChange={store.setCodePanelOpen}
        themeEditorState={themeState}
      />
      <ThemeSaveDialog
        open={store.saveDialogOpen}
        onOpenChange={store.setSaveDialogOpen}
        onSave={store.saveTheme}
        isSaving={store.isCreatingTheme}
        existingThemeName={store.existingThemeName}
        existingThemeDescription={store.existingThemeDescription}
        existingVersion={store.existingVersion}
        onUpdateExisting={store.handleUpdateExisting}
        isUpdating={store.isUpdatingTheme}
        {...getSaveDialogCopy(store.pendingAction)}
      />
      <ThemeHistoryDialog
        open={store.historyOpen}
        onOpenChange={store.setHistoryOpen}
        themeId={store.historyThemeId}
      />
      <ShareDialog
        open={store.shareDialogOpen}
        onOpenChange={store.setShareDialogOpen}
        url={store.shareUrl}
      />
    </DialogActionsContext>
  );
}

export function useDialogActions(): DialogActionsContextType {
  const context = useContext(DialogActionsContext);

  if (!context) {
    throw new Error("useDialogActions must be used within a DialogActionsProvider");
  }

  return context;
}

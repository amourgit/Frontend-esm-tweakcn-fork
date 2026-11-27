import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/store/editor-store";
import { CodeButton } from "./code-button";
import { HistoryButton } from "./history-button";
import { ImportButton } from "./import-button";
import { MoreOptions } from "./more-options";
import { ResetButton } from "./reset-button";
import { SaveButton } from "./save-button";
import { ShareButton } from "./share-button";
import { ThemeToggle } from "./theme-toggle";
import { UndoRedoButtons } from "./undo-redo-buttons";

interface ActionBarButtonsProps {
  onImportClick: () => void;
  onCodeClick: () => void;
  onSaveClick: () => void;
  onShareClick: (id?: string) => void;
  /** Fourni seulement si le thème affiché est persisté et l'utilisateur connecté. */
  onHistoryClick?: () => void;
  isSaving: boolean;
}

export function ActionBarButtons({
  onImportClick,
  onCodeClick,
  onSaveClick,
  onShareClick,
  onHistoryClick,
  isSaving,
}: ActionBarButtonsProps) {
  const { themeState, resetToCurrentPreset, hasUnsavedChanges } = useEditorStore();

  const handleReset = () => {
    resetToCurrentPreset();
  };

  return (
    <div className="flex items-center gap-1">
      <MoreOptions />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <ThemeToggle />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <UndoRedoButtons />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <ResetButton onClick={handleReset} disabled={!hasUnsavedChanges()} />
      <div className="hidden items-center gap-1 md:flex">
        <ImportButton onClick={onImportClick} />
      </div>
      <Separator orientation="vertical" className="mx-1 h-8" />
      {onHistoryClick && <HistoryButton onClick={onHistoryClick} />}
      <ShareButton onClick={() => onShareClick(themeState.preset)} />
      <SaveButton onClick={onSaveClick} isSaving={isSaving} />
      <CodeButton onClick={onCodeClick} />
    </div>
  );
}

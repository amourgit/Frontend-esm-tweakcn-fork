import { useState } from "react";
import { getThemeRevision } from "@/actions/themes";
import { toast } from "@/components/ui/use-toast";
import { useEditorStore } from "@/store/editor-store";

/**
 * Charge le contenu d'un état dans l'éditeur SANS l'enregistrer : il apparaît comme une modification
 * non enregistrée, que l'utilisateur peut sauvegarder (nouvel état) ou annuler.
 */
export function useOpenRevisionInEditor(themeId: string | undefined, onOpened: () => void) {
  const setThemeState = useEditorStore((s) => s.setThemeState);
  const [opening, setOpening] = useState<number | null>(null);

  const open = async (revision: number) => {
    if (!themeId) return;
    setOpening(revision);
    try {
      const row = await getThemeRevision(themeId, revision);
      const prev = useEditorStore.getState().themeState;
      setThemeState({ ...prev, styles: row.styles });
      onOpened();
      toast({
        title: `State ${revision} opened`,
        description: "Save to keep it as a new state, or reset to go back.",
      });
    } catch {
      toast({ title: "Could not open this state", variant: "destructive" });
    } finally {
      setOpening(null);
    }
  };

  return { open, opening };
}

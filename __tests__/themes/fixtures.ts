import { defaultThemeState } from "@/config/theme";
import { createTheme, type ThemeDb } from "@/lib/themes";

export function styleVariant(primary: string) {
  const s = structuredClone(defaultThemeState.styles);
  s.light.primary = primary;
  return s;
}

/** Crée un thème appartenant à `actorId` (état 1 + version 1). */
export async function makeUserTheme(db: ThemeDb, actorId: string, name = "Mon thème", primary = "#111111") {
  const { theme } = await createTheme(db, { actorId, name, styles: styleVariant(primary) });
  return theme;
}

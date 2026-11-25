/**
 * Génère le squelette de référence `config/tokens/egen-theme-skeleton.json` : le thème par défaut
 * entièrement résolu (couleurs tweakcn + couleurs étendues dérivées + tokens). Document de référence
 * lisible par TokiForge ; un test vérifie qu'il est toujours à jour.
 *
 *   pnpm tokens:skeleton
 */
import fs from "fs";
import path from "path";
import { defaultThemeState } from "@/config/theme";
import { buildEgenTokensDocument } from "@/utils/tokens/export-json";

export const SKELETON_META = {
  name: "EGEN Skeleton",
  description:
    "Squelette de référence neutre : toutes les variables nécessaires pour construire un thème. Un thème n'en renseigne que ce qu'il veut personnaliser.",
  author: "EGEN / CIVITAS",
};

export const SKELETON_PATH = path.join(process.cwd(), "config", "tokens", "egen-theme-skeleton.json");

if (require.main === module) {
  const document = buildEgenTokensDocument(defaultThemeState.styles, SKELETON_META);
  fs.writeFileSync(SKELETON_PATH, JSON.stringify(document, null, 2) + "\n");
  console.log(`Skeleton written to ${path.relative(process.cwd(), SKELETON_PATH)}`);
}

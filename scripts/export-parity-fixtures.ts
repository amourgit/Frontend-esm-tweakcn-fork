/**
 * Fixtures de parité pour les récepteurs du squelette (TokiForge) : les valeurs que le résolveur de
 * tweakcn produit pour les 43 thèmes intégrés. Le récepteur les rejoue avec son propre port et doit
 * obtenir exactement les mêmes résultats.
 *
 *   pnpm tsx scripts/export-parity-fixtures.ts <fichier-de-sortie.json>
 */
import crypto from "crypto";
import fs from "fs";
import { execSync } from "child_process";
import { defaultThemeState } from "@/config/theme";
import { defaultPresets } from "@/utils/theme-presets";
import { getBuiltInThemeStyles } from "@/utils/theme-preset-helper";
import { buildEgenTokensDocument, EGEN_TOKENS_VERSION } from "@/utils/tokens/export-json";
import { getExtendedColorVars, getTokenVars } from "@/utils/tokens/css-vars";
import { getTokenDefinitions } from "@/utils/tokens/registry";
import type { ThemeStyles } from "@/types/theme";

const FULL_DOCUMENTS = ["default", "violet-bloom", "cyberpunk"];

/** JSON à clés triées : même chaîne des deux côtés, quel que soit l'ordre d'insertion. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v
  );
const sha = (value: unknown) => crypto.createHash("sha256").update(canonical(value)).digest("hex");

const out = process.argv[2];
if (!out) throw new Error("usage: export-parity-fixtures.ts <sortie.json>");

const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

const themes: Record<string, unknown> = {};
const documents: Record<string, unknown> = {};
for (const name of ["default", ...Object.keys(defaultPresets)]) {
  const styles: ThemeStyles = name === "default" ? defaultThemeState.styles : getBuiltInThemeStyles(name)!.styles;
  const document = buildEgenTokensDocument(styles, { name });
  const variables = {
    light: Object.fromEntries(getExtendedColorVars(styles, "light")),
    dark: Object.fromEntries(getExtendedColorVars(styles, "dark")),
    tokens: Object.fromEntries(getTokenVars(styles)),
  };
  themes[name] = { styles, documentSha: sha(document), variablesSha: sha(variables) };
  if (FULL_DOCUMENTS.includes(name)) documents[name] = { document, variables };
}

const catalog = getTokenDefinitions().map((d) => ({
  id: d.id,
  cssVar: d.cssVar,
  group: d.group,
  kind: d.kind,
  optional: d.optional ?? false,
  defaultValue: d.defaultValue,
}));

fs.writeFileSync(
  out,
  JSON.stringify({ generatedFrom: `tweakcn@${commit}`, schema: EGEN_TOKENS_VERSION, themes, documents, catalog }, null, 1) + "\n"
);
console.log(`${Object.keys(themes).length} thèmes, ${catalog.length} tokens → ${out}`);

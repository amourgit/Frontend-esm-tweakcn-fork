import { ThemeStyleProps, ThemeTokens } from "@/types/theme";
import { colorFormatter } from "./color-converter";
import { COMMON_STYLES, defaultThemeState } from "@/config/theme";
import { DERIVED_COLOR_KEYS } from "./tokens/derive";
import { setPath, type TokenTree } from "./tokens/object-path";
import { coerceTokenValue, getTokenDefinitions, type TokenDefinition } from "./tokens/registry";

// Clés reconnues à l'import : les 44 clés tweakcn + les couleurs étendues du squelette EGEN.
export const variableNames = [...Object.keys(defaultThemeState.styles.light), ...DERIVED_COLOR_KEYS];
const nonColorVariables = COMMON_STYLES;
const VARIABLE_PREFIX = "--";

export const parseCssInput = (input: string) => {
  const lightColors: ThemeStyleProps = {} as ThemeStyleProps;
  const darkColors: ThemeStyleProps = {} as ThemeStyleProps;
  let tokens: ThemeTokens | undefined;

  try {
    const rootContent = extractCssBlockContent(input, ":root");
    const darkContent = extractCssBlockContent(input, ".dark");

    if (rootContent) {
      parseColorVariables(rootContent, lightColors, variableNames);
      tokens = parseTokenVariables(rootContent);
    }
    if (darkContent) {
      parseColorVariables(darkContent, darkColors, variableNames);
    }
  } catch (error) {
    console.error("Error parsing CSS input:", error);
  }

  return { lightColors, darkColors, tokens };
};

let tokenPathByCssVar: Map<string, TokenDefinition> | undefined;
const getTokenPathByCssVar = () =>
  (tokenPathByCssVar ??= new Map(getTokenDefinitions().filter((d) => !d.optional).map((d) => [d.cssVar, d])));

/** Variables de tokens du squelette (`--motion-duration-fast`, `--layout-sidebar-width`…) → arbre `tokens`. */
const parseTokenVariables = (cssContent: string): ThemeTokens | undefined => {
  const byVar = getTokenPathByCssVar();
  let tokens: TokenTree | undefined;
  for (const declaration of cssContent.match(/--[^:]+:\s*[^;]+/g) || []) {
    const separator = declaration.indexOf(":");
    const name = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    const entry = byVar.get(name);
    if (!entry) continue;
    tokens = setPath(tokens, entry.path, entry.kind === "color" ? processColorValue(value) : coerceTokenValue(entry, value));
  }
  return tokens;
};

const extractCssBlockContent = (
  input: string,
  selector: string
): string | null => {
  const regex = new RegExp(`${escapeRegExp(selector)}\\s*{([^}]+)}`);
  return input.match(regex)?.[1]?.trim() || null;
};

const parseColorVariables = (
  cssContent: string,
  target: ThemeStyleProps,
  validNames: string[]
) => {
  const variableDeclarations = cssContent.match(/--[^:]+:\s*[^;]+/g) || [];

  variableDeclarations.forEach((declaration) => {
    const [name, value] = declaration.split(":").map((part) => part.trim());
    const cleanName = name.replace(VARIABLE_PREFIX, "");

    if (validNames.includes(cleanName)) {
      if (nonColorVariables.includes(cleanName)) {
        target[cleanName as keyof ThemeStyleProps] = value;
        return;
      }

      const colorValue = processColorValue(value);
      const formattedValue = colorFormatter(colorValue, "hex");
      target[cleanName as keyof ThemeStyleProps] = formattedValue;
    }
  });
};

const processColorValue = (value: string): string => {
  return /^\d/.test(value) ? `hsl(${value})` : value;
};

// Helper function to escape regex special characters
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

import { ThemeEditorState } from "@/types/editor";
import { colorFormatter } from "./color-converter";
import { ColorFormat } from "../types";
import { getShadowMap } from "./shadows";
import { defaultLightThemeStyles } from "@/config/theme";
import { ThemeStyles } from "@/types/theme";
import { extractFontFamily } from "./fonts";
import { getExtendedColorVars, getTokenVarGroups, kebab, type CssVar } from "./tokens/css-vars";
import { keysAt } from "./tokens/object-path";
import { resolveTheme } from "./tokens/resolve";

/**
 * - `standard` : variables shadcn historiques uniquement (copier-coller dans un projet shadcn).
 * - `complete` : + couleurs étendues du squelette EGEN et tokens (typographie, layout, mouvement…).
 */
export type TokenScope = "standard" | "complete";
export interface GenerateOptions {
  scope?: TokenScope;
}

type ThemeMode = "light" | "dark";

const generateColorVariables = (
  themeStyles: ThemeStyles,
  mode: ThemeMode,
  formatColor: (color: string) => string
): string => {
  const styles = themeStyles[mode];
  return `
  --background: ${formatColor(styles.background)};
  --foreground: ${formatColor(styles.foreground)};
  --card: ${formatColor(styles.card)};
  --card-foreground: ${formatColor(styles["card-foreground"])};
  --popover: ${formatColor(styles.popover)};
  --popover-foreground: ${formatColor(styles["popover-foreground"])};
  --primary: ${formatColor(styles.primary)};
  --primary-foreground: ${formatColor(styles["primary-foreground"])};
  --secondary: ${formatColor(styles.secondary)};
  --secondary-foreground: ${formatColor(styles["secondary-foreground"])};
  --muted: ${formatColor(styles.muted)};
  --muted-foreground: ${formatColor(styles["muted-foreground"])};
  --accent: ${formatColor(styles.accent)};
  --accent-foreground: ${formatColor(styles["accent-foreground"])};
  --destructive: ${formatColor(styles.destructive)};
  --destructive-foreground: ${formatColor(styles["destructive-foreground"])};
  --border: ${formatColor(styles.border)};
  --input: ${formatColor(styles.input)};
  --ring: ${formatColor(styles.ring)};
  --chart-1: ${formatColor(styles["chart-1"])};
  --chart-2: ${formatColor(styles["chart-2"])};
  --chart-3: ${formatColor(styles["chart-3"])};
  --chart-4: ${formatColor(styles["chart-4"])};
  --chart-5: ${formatColor(styles["chart-5"])};
  --sidebar: ${formatColor(styles.sidebar)};
  --sidebar-foreground: ${formatColor(styles["sidebar-foreground"])};
  --sidebar-primary: ${formatColor(styles["sidebar-primary"])};
  --sidebar-primary-foreground: ${formatColor(styles["sidebar-primary-foreground"])};
  --sidebar-accent: ${formatColor(styles["sidebar-accent"])};
  --sidebar-accent-foreground: ${formatColor(styles["sidebar-accent-foreground"])};
  --sidebar-border: ${formatColor(styles["sidebar-border"])};
  --sidebar-ring: ${formatColor(styles["sidebar-ring"])};`;
};

const generateFontVariables = (themeStyles: ThemeStyles, mode: ThemeMode): string => {
  const styles = themeStyles[mode];
  return `
  --font-sans: ${styles["font-sans"]};
  --font-serif: ${styles["font-serif"]};
  --font-mono: ${styles["font-mono"]};`;
};

const generateShadowVariables = (shadowMap: Record<string, string>): string => {
  return `
  --shadow-2xs: ${shadowMap["shadow-2xs"]};
  --shadow-xs: ${shadowMap["shadow-xs"]};
  --shadow-sm: ${shadowMap["shadow-sm"]};
  --shadow: ${shadowMap["shadow"]};
  --shadow-md: ${shadowMap["shadow-md"]};
  --shadow-lg: ${shadowMap["shadow-lg"]};
  --shadow-xl: ${shadowMap["shadow-xl"]};
  --shadow-2xl: ${shadowMap["shadow-2xl"]};`;
};

const generateRawShadowVariables = (themeStyles: ThemeStyles, mode: ThemeMode): string => {
  const styles = themeStyles[mode];
  return `
  --shadow-x: ${styles["shadow-offset-x"]};
  --shadow-y: ${styles["shadow-offset-y"]};
  --shadow-blur: ${styles["shadow-blur"]};
  --shadow-spread: ${styles["shadow-spread"]};
  --shadow-opacity: ${styles["shadow-opacity"]};
  --shadow-color: ${styles["shadow-color"]};`;
};

const generateTrackingVariables = (themeStyles: ThemeStyles): string => {
  const styles = themeStyles["light"];
  if (styles["letter-spacing"] === "0em") {
    return "";
  }
  return `

  --tracking-tighter: calc(var(--tracking-normal) - 0.05em);
  --tracking-tight: calc(var(--tracking-normal) - 0.025em);
  --tracking-normal: var(--tracking-normal);
  --tracking-wide: calc(var(--tracking-normal) + 0.025em);
  --tracking-wider: calc(var(--tracking-normal) + 0.05em);
  --tracking-widest: calc(var(--tracking-normal) + 0.1em);`;
};

const formatVarLines = (vars: CssVar[]) => vars.map(([name, value]) => `\n  ${name}: ${value};`).join("");

const generateExtendedColorVariables = (
  themeStyles: ThemeStyles,
  mode: ThemeMode,
  formatColor: (color: string) => string
): string => {
  const vars = getExtendedColorVars(themeStyles, mode, formatColor);
  return vars.length ? `\n\n  /* Extended colors */${formatVarLines(vars)}` : "";
};

const TOKEN_GROUP_TITLES: Record<string, string> = {
  palette: "palette",
  typography: "typography",
  sizing: "sizing",
  density: "density",
  radius: "radius",
  border: "borders",
  shadow: "shadows",
  opacity: "opacity",
  layout: "layout",
  component: "components",
  motion: "motion",
  effects: "effects",
  zIndex: "z-index",
  icons: "icons",
  a11y: "accessibility",
};

const generateTokenVariables = (
  themeStyles: ThemeStyles,
  formatColor: (color: string) => string
): string =>
  getTokenVarGroups(themeStyles, formatColor)
    .map(({ group, vars }) => `\n\n  /* Tokens — ${TOKEN_GROUP_TITLES[group] ?? group} */${formatVarLines(vars)}`)
    .join("");

const generateThemeVariables = (
  themeStyles: ThemeStyles,
  mode: ThemeMode,
  formatColor: (color: string) => string,
  scope: TokenScope = "standard"
): string => {
  const selector = mode === "dark" ? ".dark" : ":root";
  const colorVars = generateColorVariables(themeStyles, mode, formatColor);
  const fontVars = generateFontVariables(themeStyles, mode);
  const radiusVar = `\n  --radius: ${themeStyles[mode].radius};`;
  const shadowVars = generateShadowVariables(
    getShadowMap({ styles: themeStyles, currentMode: mode })
  );
  const rawShadowVars = generateRawShadowVariables(themeStyles, mode);
  const spacingVar =
    mode === "light"
      ? `\n  --spacing: ${themeStyles["light"].spacing ?? defaultLightThemeStyles.spacing};`
      : "";

  const trackingVars =
    mode === "light"
      ? `\n  --tracking-normal: ${themeStyles["light"]["letter-spacing"] ?? defaultLightThemeStyles["letter-spacing"]};`
      : "";

  const complete = scope === "complete";
  const extendedVars = complete ? generateExtendedColorVariables(themeStyles, mode, formatColor) : "";
  const tokenVars = complete && mode === "light" ? generateTokenVariables(themeStyles, formatColor) : "";

  return (
    selector +
    " {" +
    colorVars +
    fontVars +
    radiusVar +
    rawShadowVars +
    shadowVars +
    trackingVars +
    spacingVar +
    extendedVars +
    tokenVars +
    "\n}"
  );
};

/** Correspondances Tailwind v4 des tokens étendus (utilitaires `bg-success`, `text-lg`, `ease-spring`…). */
const generateTailwindV4ExtendedMappings = (themeStyles: ThemeStyles): string => {
  const resolved = resolveTheme(themeStyles);
  const tokens = resolved.tokens;
  const lines: string[] = [];
  const add = (name: string, value: string) => lines.push(`  ${name}: ${value};`);

  for (const [name] of getExtendedColorVars(themeStyles, "light")) add(`--color-${name.slice(2)}`, `var(${name})`);

  for (const key of keysAt(tokens, ["typography", "fontSize"])) {
    add(`--text-${key}`, `var(--typography-font-size-${key}-size)`);
    add(`--text-${key}--line-height`, `var(--typography-font-size-${key}-line-height)`);
  }
  for (const key of keysAt(tokens, ["typography", "fontWeight"]))
    add(`--font-weight-${key}`, `var(--typography-font-weight-${key})`);
  for (const key of keysAt(tokens, ["typography", "lineHeight"]))
    add(`--leading-${key}`, `var(--typography-line-height-${key})`);
  for (const key of keysAt(tokens, ["motion", "easing"])) add(`--ease-${kebab(key)}`, `var(--motion-easing-${kebab(key)})`);
  for (const key of keysAt(tokens, ["effects", "blur"]))
    if (key !== "none") add(`--blur-${key}`, `var(--effects-blur-${key})`);

  return lines.join("\n");
};

const generateTailwindV4ThemeInline = (themeStyles: ThemeStyles, scope: TokenScope = "standard"): string => {
  const complete = scope === "complete";
  // En mode complet, l'échelle de radius pointe vers les tokens (modifiables) au lieu de calc() figés.
  const radiusBlock = complete
    ? keysAt(resolveTheme(themeStyles).tokens, ["radius"])
        .filter((key) => key !== "component" && key !== "lg")
        .map((key) => `  --radius-${key}: var(--radius-${key});`)
        .concat("  --radius-lg: var(--radius-lg);")
        .join("\n")
    : `  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);`;
  const extendedMappings = complete ? `\n\n${generateTailwindV4ExtendedMappings(themeStyles)}` : "";
  return `@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

${radiusBlock}

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);${generateTrackingVariables(themeStyles)}${extendedMappings}
}`;
};

const generateTailwindV3Config = (
  themeStyles: ThemeStyles,
  colorFormat: ColorFormat = "hsl",
  scope: TokenScope = "standard"
): string => {
  const colorToken = (key: string) => {
    return colorFormat === "hsl" ? `"hsl(var(--${key}))"` : `"var(--${key})"`;
  };

  const complete = scope === "complete";
  const tokens = complete ? resolveTheme(themeStyles).tokens : {};
  const entries = (keys: string[], fn: (key: string) => string) =>
    keys
      .map((key) => `        ${JSON.stringify(kebab(key))}: ${fn(key)},`)
      .join("\n");
  const extendedColors = complete
    ? "\n" +
      getExtendedColorVars(themeStyles, "light")
        .map(([name]) => `        ${JSON.stringify(name.slice(2))}: ${colorToken(name.slice(2))},`)
        .join("\n")
    : "";
  const section = (title: string, body: string) => (complete && body ? `      ${title}: {\n${body}\n      },\n` : "");
  const extendedSections =
    section(
      "fontSize",
      entries(
        keysAt(tokens, ["typography", "fontSize"]),
        (k) => `["var(--typography-font-size-${k}-size)", { lineHeight: "var(--typography-font-size-${k}-line-height)" }]`
      )
    ) +
    section("fontWeight", entries(keysAt(tokens, ["typography", "fontWeight"]), (k) => `"var(--typography-font-weight-${k})"`)) +
    section("lineHeight", entries(keysAt(tokens, ["typography", "lineHeight"]), (k) => `"var(--typography-line-height-${k})"`)) +
    section(
      "transitionTimingFunction",
      entries(keysAt(tokens, ["motion", "easing"]), (k) => `"var(--motion-easing-${kebab(k)})"`)
    ) +
    section(
      "transitionDuration",
      entries(keysAt(tokens, ["motion", "duration"]), (k) => `"var(--motion-duration-${kebab(k)})"`)
    ) +
    section("zIndex", entries(keysAt(tokens, ["zIndex"]), (k) => `"var(--z-index-${kebab(k)})"`)) +
    section(
      "blur",
      entries(
        keysAt(tokens, ["effects", "blur"]).filter((k) => k !== "none"),
        (k) => `"var(--effects-blur-${k})"`
      )
    );
  const radiusEntries = complete
    ? `        xs: "var(--radius-xs)",\n        "2xl": "var(--radius-2xl)",\n        "3xl": "var(--radius-3xl)",\n        "4xl": "var(--radius-4xl)",\n`
    : "";

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: ${colorToken("border")},
        input: ${colorToken("input")},
        ring: ${colorToken("ring")},
        background: ${colorToken("background")},
        foreground: ${colorToken("foreground")},
        primary: {
          DEFAULT: ${colorToken("primary")},
          foreground: ${colorToken("primary-foreground")},
        },
        secondary: {
          DEFAULT: ${colorToken("secondary")},
          foreground: ${colorToken("secondary-foreground")},
        },
        destructive: {
          DEFAULT: ${colorToken("destructive")},
          foreground: ${colorToken("destructive-foreground")},
        },
        muted: {
            DEFAULT: ${colorToken("muted")},
          foreground: ${colorToken("muted-foreground")},
        },
        accent: {
          DEFAULT: ${colorToken("accent")},
          foreground: ${colorToken("accent-foreground")},
        },
        popover: {
          DEFAULT: ${colorToken("popover")},
          foreground: ${colorToken("popover-foreground")},
        },
        card: {
          DEFAULT: ${colorToken("card")},
          foreground: ${colorToken("card-foreground")},
        },
        sidebar: {
          DEFAULT: ${colorToken("sidebar")},
          foreground: ${colorToken("sidebar-foreground")},
          primary: ${colorToken("sidebar-primary")},
          "primary-foreground": ${colorToken("sidebar-primary-foreground")},
          accent: ${colorToken("sidebar-accent")},
          "accent-foreground": ${colorToken("sidebar-accent-foreground")},
          border: ${colorToken("sidebar-border")},
          ring: ${colorToken("sidebar-ring")},
        },
        chart: {
          1: ${colorToken("chart-1")},
          2: ${colorToken("chart-2")},
          3: ${colorToken("chart-3")},
          4: ${colorToken("chart-4")},
          5: ${colorToken("chart-5")},
        },${extendedColors}
      },
      borderRadius: {
${radiusEntries}        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
${extendedSections}    },
  },
}`;
};

const indentBlock = (str: string): string =>
  str
    .split("\n")
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join("\n");

export const generateThemeCode = (
  themeEditorState: ThemeEditorState,
  colorFormat: ColorFormat = "hsl",
  tailwindVersion: "3" | "4" = "3",
  options: GenerateOptions = {}
): string => {
  const scope = options.scope ?? "standard";
  if (
    !themeEditorState ||
    !("light" in themeEditorState.styles) ||
    !("dark" in themeEditorState.styles)
  ) {
    throw new Error("Invalid theme styles: missing light or dark mode");
  }

  const themeStyles = themeEditorState.styles as ThemeStyles;
  const formatColor = (color: string) => colorFormatter(color, colorFormat, tailwindVersion);

  const lightTheme = generateThemeVariables(themeStyles, "light", formatColor, scope);
  const darkTheme = generateThemeVariables(themeStyles, "dark", formatColor, scope);

  if (tailwindVersion === "4") {
    const tailwindV4Theme = generateTailwindV4ThemeInline(themeStyles, scope);

    const bodyLetterSpacing =
      themeStyles["light"]["letter-spacing"] !== "0em"
        ? "\n    letter-spacing: var(--tracking-normal);"
        : "";

    return `@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

${lightTheme}

${darkTheme}

${tailwindV4Theme}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;${bodyLetterSpacing}
  }
}`;
  }

  // Tailwind v3
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
${indentBlock(lightTheme)}

${indentBlock(darkTheme)}
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;
};

export const generateTailwindConfigCode = (
  themeEditorState: ThemeEditorState,
  colorFormat: ColorFormat = "hsl",
  _tailwindVersion: "3" | "4" = "3",
  options: GenerateOptions = {}
): string => {
  if (
    !themeEditorState ||
    !("light" in themeEditorState.styles) ||
    !("dark" in themeEditorState.styles)
  ) {
    throw new Error("Invalid theme styles: missing light or dark mode");
  }

  const themeStyles = themeEditorState.styles as ThemeStyles;
  return generateTailwindV3Config(themeStyles, colorFormat, options.scope ?? "standard");
};

const FONT_SLOTS = [
  { key: "font-sans" as const, varName: "fontSans", cssVar: "--font-sans" },
  { key: "font-serif" as const, varName: "fontSerif", cssVar: "--font-serif" },
  { key: "font-mono" as const, varName: "fontMono", cssVar: "--font-mono" },
];

export const generateLayoutCode = (themeEditorState: ThemeEditorState): string => {
  if (
    !themeEditorState ||
    !("light" in themeEditorState.styles) ||
    !("dark" in themeEditorState.styles)
  ) {
    throw new Error("Invalid theme styles: missing light or dark mode");
  }

  const themeStyles = themeEditorState.styles as ThemeStyles;
  const lightStyles = themeStyles.light;

  const googleFonts: { importName: string; varName: string; cssVar: string }[] = [];

  for (const slot of FONT_SLOTS) {
    const fontValue = lightStyles[slot.key];
    const fontFamily = extractFontFamily(fontValue);
    if (fontFamily) {
      googleFonts.push({
        importName: fontFamily.replace(/ /g, "_"),
        varName: slot.varName,
        cssVar: slot.cssVar,
      });
    }
  }

  const comment = `// For adding custom fonts with other frameworks, see:\n// https://tailwindcss.com/docs/font-family`;

  if (googleFonts.length === 0) {
    return `${comment}
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}`;
  }

  const importNames = googleFonts.map((f) => f.importName).join(", ");

  const fontConfigs = googleFonts
    .map(
      (f) => `
const ${f.varName} = ${f.importName}({
  subsets: ["latin"],
  variable: "${f.cssVar}",
});`
    )
    .join("\n");

  const classNameParts = googleFonts.map((f) => `\${${f.varName}.variable}`).join(" ");

  return `${comment}
import type { Metadata } from "next";
import { ${importNames} } from "next/font/google";
import "./globals.css";
${fontConfigs}

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={\`${classNameParts} antialiased\`}>
        {children}
      </body>
    </html>
  );
}`;
};

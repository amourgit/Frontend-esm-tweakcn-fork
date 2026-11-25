import { theme } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { z } from "zod";

export const themeStylePropsSchema = z.object({
  background: z.string().describe("The default background color, paired with `foreground`."),
  foreground: z.string().describe("Paired with `background`."),
  card: z.string().describe("The background color for cards, paired with `card-foreground`."),
  "card-foreground": z.string().describe("Paired with `card`."),
  popover: z
    .string()
    .describe("The background color for popovers, paired with `popover-foreground`."),
  "popover-foreground": z.string().describe("Paired with `popover`."),
  primary: z.string().describe("The main color, paired with `primary-foreground`."),
  "primary-foreground": z.string().describe("Paired with `primary`."),
  secondary: z.string().describe("A secondary color, paired with `secondary-foreground`."),
  "secondary-foreground": z.string().describe("Paired with `secondary`."),
  muted: z.string().describe("A muted background color, paired with `muted-foreground`."),
  "muted-foreground": z.string().describe("Paired with `muted`."),
  accent: z
    .string()
    .describe("Subtle color for hover or highlight, paired with `accent-foreground`."),
  "accent-foreground": z.string().describe("Paired with `accent`."),
  destructive: z
    .string()
    .describe("Color for destructive actions, paired with `destructive-foreground`."),
  "destructive-foreground": z.string().describe("Paired with `destructive`."),
  border: z.string().describe("The color for borders."),
  input: z.string().describe("The background color for input fields."),
  ring: z.string().describe("The color for focus rings."),
  "chart-1": z.string(),
  "chart-2": z.string(),
  "chart-3": z.string(),
  "chart-4": z.string(),
  "chart-5": z.string(),
  sidebar: z
    .string()
    .describe("The background color for the sidebar, paired with `sidebar-foreground`."),
  "sidebar-foreground": z.string().describe("Paired with `sidebar`."),
  "sidebar-primary": z
    .string()
    .describe("The primary color for sidebar elements, paired with `sidebar-primary-foreground`."),
  "sidebar-primary-foreground": z.string().describe("Paired with `sidebar-primary`."),
  "sidebar-accent": z
    .string()
    .describe("An accent color for the sidebar, paired with `sidebar-accent-foreground`."),
  "sidebar-accent-foreground": z.string().describe("Paired with `sidebar-accent`."),
  "sidebar-border": z.string().describe("The color for borders within the sidebar."),
  "sidebar-ring": z.string().describe("The color for focus rings within the sidebar."),
  "font-sans": z
    .string()
    .describe(
      "Primary UI font. May be serif, sans, monospace, or display depending on the theme vibe."
    ),
  "font-serif": z.string().describe("The preferred serif font family."),
  "font-mono": z.string().describe("The preferred monospace font family. Used for code blocks."),
  radius: z
    .string()
    .describe("The global border-radius for components. Use 0rem for sharp corners."),
  "shadow-color": z.string(),
  "shadow-opacity": z.string(),
  "shadow-blur": z.string(),
  "shadow-spread": z.string(),
  "shadow-offset-x": z.string(),
  "shadow-offset-y": z.string(),
  "letter-spacing": z.string().describe("The global letter spacing for text."),
  spacing: z.string().optional(),
});

export const themeStylesSchema = z.object({
  light: themeStylePropsSchema,
  dark: themeStylePropsSchema,
});

/**
 * Schémas de VALIDATION à la frontière (server actions) : identiques aux schémas ci-dessus pour
 * les clés connues, mais ils ne détruisent plus rien.
 *
 * `z.object` supprime par défaut les clés inconnues : un thème enrichi (tokens EGEN) perdait donc
 * tout ce que tweakcn ne connaissait pas au moment de la sauvegarde. Ici :
 *  - `light` / `dark` acceptent toute clé supplémentaire de type chaîne (couleurs, longueurs,
 *    valeurs CSS) ;
 *  - `tokens` porte les tokens indépendants du mode (typographie, layout, mouvement, z-index…) ;
 *    c'est un objet JSON libre, borné en taille.
 * Les types TypeScript exportés (ThemeStyleProps, ThemeStyles) restent dérivés des schémas stricts
 * pour garder `keyof ThemeStyleProps` précis dans tout l'éditeur.
 */
export const MAX_THEME_STYLES_BYTES = 256 * 1024;

export const themeStylePropsInputSchema = themeStylePropsSchema.catchall(z.string());

export const themeTokensSchema = z.record(z.string(), z.unknown());

export const themeStylesInputSchema = z
  .object({
    light: themeStylePropsInputSchema,
    dark: themeStylePropsInputSchema,
    tokens: themeTokensSchema.optional(),
  })
  .refine((styles) => JSON.stringify(styles).length <= MAX_THEME_STYLES_BYTES, {
    message: `Theme styles too large (max ${MAX_THEME_STYLES_BYTES / 1024} KB)`,
  });

export type ThemeStyleProps = z.infer<typeof themeStylePropsSchema>;
export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type ThemeStyles = z.infer<typeof themeStylesSchema> & {
  /** Tokens indépendants du mode (optionnels) — voir `themeStylesInputSchema`. */
  tokens?: ThemeTokens;
};

export const themeStylePropsSchemaWithoutSpacing = themeStylePropsSchema.omit({
  spacing: true,
});

export const themeStylesSchemaWithoutSpacing = z.object({
  light: themeStylePropsSchemaWithoutSpacing,
  dark: themeStylePropsSchemaWithoutSpacing,
});

export type ThemeStylesWithoutSpacing = z.infer<typeof themeStylesSchemaWithoutSpacing>;

export interface ThemeEditorPreviewProps {
  styles: ThemeStyles;
  currentMode: "light" | "dark";
}

export interface ThemeEditorControlsProps {
  styles: ThemeStyles;
  currentMode: "light" | "dark";
  onChange: (styles: ThemeStyles) => void;
}

/** Clés d'un mode : celles de tweakcn + toute couleur étendue du squelette EGEN, toutes optionnelles. */
export type PartialThemeStyleProps = Partial<ThemeStyleProps> & { [key: string]: string | undefined };

export type ThemePreset = {
  source?: "SAVED" | "BUILT_IN";
  createdAt?: string;
  label?: string;
  styles: {
    light: PartialThemeStyleProps;
    dark: PartialThemeStyleProps;
    /** Tokens indépendants du mode que le preset souhaite personnaliser (tous optionnels). */
    tokens?: ThemeTokens;
  };
};

export type Theme = InferSelectModel<typeof theme>;

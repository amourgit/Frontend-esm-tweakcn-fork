import { TAILWIND_PALETTE } from "@/utils/registry/tailwind-colors";
import type { TokenTree } from "@/utils/tokens/object-path";

/**
 * Valeurs par défaut des tokens INDÉPENDANTS DU MODE du squelette de référence EGEN.
 *
 * Neutre et généraliste : aucun style propre à un thème (verre, néon…). Un thème n'a à renseigner
 * que ce qu'il veut personnaliser (`styles.tokens`), le reste vient d'ici.
 *
 * Convention de nommage CSS : tokens.<groupe>.<chemin> → --<groupe>-<chemin> (kebab-case).
 * Les rampes `palette.primary|secondary|accent|neutral|error` ne sont pas listées ici : elles sont
 * DÉRIVÉES des couleurs du thème (voir utils/tokens/derive.ts), sauf si le thème les renseigne.
 */

const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
const rampOf = (name: "green" | "amber" | "blue") =>
  Object.fromEntries(SHADES.map((shade) => [shade, TAILWIND_PALETTE[name][shade]])) as TokenTree;

export const DEFAULT_TOKENS: TokenTree = {
  palette: {
    success: rampOf("green"),
    warning: rampOf("amber"),
    info: rampOf("blue"),
  },
  typography: {
    fontFamily: {
      heading: "var(--font-sans)",
      body: "var(--font-sans)",
      display: "var(--font-sans)",
      ui: "var(--font-sans)",
      code: "var(--font-mono)",
    },
    fontSize: Object.fromEntries(
      (
        [
          ["xs", "0.75rem", "1rem"],
          ["sm", "0.875rem", "1.25rem"],
          ["base", "1rem", "1.5rem"],
          ["lg", "1.125rem", "1.75rem"],
          ["xl", "1.25rem", "1.75rem"],
          ["2xl", "1.5rem", "2rem"],
          ["3xl", "1.875rem", "2.25rem"],
          ["4xl", "2.25rem", "2.5rem"],
          ["5xl", "3rem", "1"],
          ["6xl", "3.75rem", "1"],
          ["7xl", "4.5rem", "1"],
          ["8xl", "6rem", "1"],
          ["9xl", "8rem", "1"],
        ] as const
      ).map(([key, size, lineHeight]) => [key, { size, lineHeight }])
    ),
    fontWeight: {
      thin: "100",
      extralight: "200",
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "900",
    },
    lineHeight: { none: "1", tight: "1.25", snug: "1.375", normal: "1.5", relaxed: "1.625", loose: "2" },
    tracking: {
      tighter: "-0.05em",
      tight: "-0.025em",
      normal: "0em",
      wide: "0.025em",
      wider: "0.05em",
      widest: "0.1em",
    },
    scale: Object.fromEntries(
      (
        [
          ["display", "3.75rem", "700", "1", "-0.025em"],
          ["h1", "2.25rem", "700", "2.5rem", "-0.025em"],
          ["h2", "1.875rem", "700", "2.25rem", "-0.025em"],
          ["h3", "1.5rem", "600", "2rem", "0em"],
          ["h4", "1.25rem", "600", "1.75rem", "0em"],
          ["h5", "1.125rem", "500", "1.75rem", "0em"],
          ["h6", "1rem", "500", "1.5rem", "0em"],
          ["lead", "1.25rem", "400", "1.75rem", "0em"],
          ["body", "1rem", "400", "1.5rem", "0em"],
          ["body-sm", "0.875rem", "400", "1.25rem", "0em"],
          ["caption", "0.75rem", "400", "1rem", "0em"],
          ["overline", "0.75rem", "600", "1rem", "0.1em"],
          ["label", "0.875rem", "500", "1.25rem", "0em"],
          ["button", "0.875rem", "500", "1.25rem", "0em"],
          ["code", "0.875rem", "400", "1.5rem", "0em"],
        ] as const
      ).map(([key, size, weight, lineHeight, letterSpacing]) => [
        key,
        { size, weight, lineHeight, letterSpacing },
      ])
    ),
  },
  sizing: {
    container: {
      sm: "24rem",
      md: "28rem",
      lg: "32rem",
      xl: "36rem",
      "2xl": "42rem",
      "3xl": "48rem",
      "4xl": "56rem",
      "5xl": "64rem",
      "6xl": "72rem",
      "7xl": "80rem",
    },
    control: { xs: "1.5rem", sm: "2rem", md: "2.25rem", lg: "2.5rem", xl: "3rem" },
    touchTarget: "2.75rem",
  },
  density: { default: "comfortable", scale: { compact: "0.875", comfortable: "1", spacious: "1.125" } },
  radius: {
    none: "0px",
    xs: "calc(var(--radius) - 6px)",
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
    xl: "calc(var(--radius) + 4px)",
    "2xl": "calc(var(--radius) + 8px)",
    "3xl": "calc(var(--radius) + 12px)",
    "4xl": "calc(var(--radius) + 16px)",
    full: "9999px",
    component: {
      control: "var(--radius-md)",
      card: "var(--radius-xl)",
      popover: "var(--radius-md)",
      dialog: "var(--radius-xl)",
      badge: "var(--radius-full)",
      tooltip: "var(--radius-sm)",
      toast: "var(--radius-lg)",
    },
  },
  border: {
    width: { none: "0px", hairline: "0.5px", thin: "1px", medium: "2px", thick: "4px" },
    style: "solid",
    ring: { width: "3px", offset: "2px", style: "solid" },
    component: {
      control: "var(--border-width-thin)",
      card: "var(--border-width-thin)",
      divider: "var(--border-width-thin)",
    },
  },
  shadow: {
    inner: "inset 0 2px 4px 0 oklch(0 0 0 / 0.05)",
    focus: "0 0 0 3px var(--ring)",
    component: {
      card: "var(--shadow-sm)",
      dropdown: "var(--shadow-md)",
      popover: "var(--shadow-md)",
      dialog: "var(--shadow-xl)",
      toast: "var(--shadow-lg)",
      tooltip: "var(--shadow-sm)",
      sticky: "var(--shadow-xs)",
    },
  },
  opacity: { disabled: "0.5", hover: "0.9", pressed: "0.8", muted: "0.6", overlay: "0.5", scrim: "0.3" },
  layout: {
    sidebar: { width: "16rem", collapsedWidth: "4rem", position: "left", variant: "solid", breakpoint: "lg" },
    header: { height: "4rem", sticky: true, variant: "solid" },
    content: { maxWidth: "87.5rem", paddingX: "1.5rem", paddingY: "1.5rem", gridColumns: "12", gridGap: "1.5rem" },
    footer: { height: "auto", visible: true },
    breakpoints: { sm: "40rem", md: "48rem", lg: "64rem", xl: "80rem", "2xl": "96rem" },
  },
  component: {
    button: {
      heightSm: "var(--sizing-control-sm)",
      heightMd: "var(--sizing-control-md)",
      heightLg: "var(--sizing-control-lg)",
      paddingX: "1rem",
      gap: "0.5rem",
      fontWeight: "var(--typography-font-weight-medium)",
      radius: "var(--radius-component-control)",
    },
    input: {
      height: "var(--sizing-control-md)",
      paddingX: "0.75rem",
      borderWidth: "var(--border-component-control)",
      radius: "var(--radius-component-control)",
    },
    card: {
      padding: "1.5rem",
      gap: "1.5rem",
      borderWidth: "var(--border-component-card)",
      radius: "var(--radius-component-card)",
      shadow: "var(--shadow-component-card)",
    },
    badge: {
      paddingX: "0.5rem",
      paddingY: "0.125rem",
      fontSize: "0.75rem",
      fontWeight: "600",
      radius: "var(--radius-component-badge)",
    },
    dialog: {
      maxWidth: "32rem",
      padding: "1.5rem",
      radius: "var(--radius-component-dialog)",
      shadow: "var(--shadow-component-dialog)",
    },
    tooltip: {
      paddingX: "0.75rem",
      paddingY: "0.375rem",
      fontSize: "0.75rem",
      radius: "var(--radius-component-tooltip)",
    },
    table: { rowHeight: "3rem", cellPaddingX: "1rem", cellPaddingY: "0.5rem", headerFontWeight: "500" },
    toast: { width: "22.5rem", padding: "1rem", radius: "var(--radius-component-toast)" },
    scrollbar: { width: "0.5rem", radius: "9999px" },
  },
  motion: {
    duration: {
      instant: "50ms",
      fast: "100ms",
      normal: "200ms",
      moderate: "300ms",
      slow: "500ms",
      slower: "700ms",
      slowest: "1000ms",
    },
    easing: {
      linear: "linear",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.2, 1)",
      inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
      spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      smooth: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      emphasized: "cubic-bezier(0.2, 0, 0, 1)",
    },
    delay: { none: "0ms", short: "75ms", medium: "150ms", long: "300ms" },
    transition: {
      default: "all var(--motion-duration-normal) var(--motion-easing-in-out)",
      fast: "all var(--motion-duration-fast) var(--motion-easing-in-out)",
      slow: "all var(--motion-duration-slow) var(--motion-easing-in-out)",
      colors:
        "color var(--motion-duration-fast) ease, background-color var(--motion-duration-normal) ease, border-color var(--motion-duration-normal) ease",
      transform: "transform var(--motion-duration-normal) var(--motion-easing-out)",
      opacity: "opacity var(--motion-duration-normal) ease",
      shadow: "box-shadow var(--motion-duration-normal) ease",
      sidebar:
        "width var(--motion-duration-moderate) var(--motion-easing-in-out), transform var(--motion-duration-moderate) var(--motion-easing-in-out)",
      overlay: "opacity var(--motion-duration-normal) ease, visibility var(--motion-duration-normal) ease",
    },
    reduced: "respect",
  },
  effects: {
    blur: { none: "0px", xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "40px", "2xl": "64px", "3xl": "80px" },
    saturate: { none: "100%", low: "140%", medium: "180%", high: "200%" },
    brightness: { dim: "90%", none: "100%", bright: "110%" },
  },
  zIndex: {
    hide: -1,
    base: 0,
    raised: 10,
    dropdown: 100,
    sticky: 200,
    overlay: 300,
    modal: 400,
    popover: 500,
    toast: 600,
    tooltip: 700,
    top: 9999,
  },
  icons: {
    library: "lucide",
    strokeWidth: "1.5",
    size: { xs: "0.75rem", sm: "1rem", md: "1.25rem", lg: "1.5rem", xl: "2rem", "2xl": "3rem" },
  },
  a11y: { targetContrast: "4.5", focusVisible: "ring", forcedColors: "respect" },
};

/** Rampes dérivées des couleurs du thème : nom de rampe → clé de couleur (mode clair) de base. */
export const DERIVED_PALETTES = {
  primary: "primary",
  secondary: "secondary",
  accent: "accent",
  neutral: "muted-foreground",
  error: "destructive",
} as const;

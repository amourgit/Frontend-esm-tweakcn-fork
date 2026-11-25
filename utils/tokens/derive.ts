import { TAILWIND_PALETTE } from "@/utils/registry/tailwind-colors";
import { LIGHT_TEXT, DARK_TEXT, chromaOf, mix, readableOn } from "./color-math";

/**
 * Couleurs ÉTENDUES du squelette EGEN (au-delà des 44 clés de tweakcn) et leur règle de dérivation.
 *
 * Un thème peut renseigner n'importe laquelle de ces clés dans `styles.light` / `styles.dark`
 * (elle devient alors un « override » explicite). Sinon la valeur est calculée à partir des couleurs
 * du thème lui-même : un preset violet obtient donc un `primary-hover` violet, pas un gris neutre.
 */

export type Mode = "light" | "dark";

export interface DeriveContext {
  mode: Mode;
  isLight: boolean;
  /** Valeur résolue (override explicite, sinon dérivée, sinon clé de base) d'une couleur. */
  get: (key: string) => string;
}

export interface DerivedColorDef {
  key: string;
  label: string;
  group: ExtendedColorGroupId;
  derive: (ctx: DeriveContext) => string;
}

export type ExtendedColorGroupId =
  | "status"
  | "states"
  | "surfaces"
  | "borders"
  | "text"
  | "charts"
  | "sidebar"
  | "scrollbar";

export const EXTENDED_COLOR_GROUPS: { id: ExtendedColorGroupId; title: string; description: string }[] = [
  { id: "status", title: "Status", description: "Success, warning, info and destructive feedback colors." },
  { id: "states", title: "Interactive states", description: "Hover, active and subtle variants of the main roles." },
  { id: "surfaces", title: "Surfaces & layout", description: "Elevations, header, footer, tooltip and overlays." },
  { id: "borders", title: "Borders & focus", description: "Border intensities, divider and focus rings." },
  { id: "text", title: "Text, links & selection", description: "Links, placeholder, selection, highlight, code and disabled." },
  { id: "charts", title: "Charts (extended)", description: "Extra series colors, grid and axis." },
  { id: "sidebar", title: "Sidebar (extended)", description: "Muted, hover and active sidebar states." },
  { id: "scrollbar", title: "Scrollbar", description: "Scrollbar thumb and track." },
];

const tw = (name: keyof typeof TAILWIND_PALETTE, shade: string) =>
  (TAILWIND_PALETTE[name] as Record<string, string>)[shade];

const def = (
  key: string,
  label: string,
  group: ExtendedColorGroupId,
  derive: (ctx: DeriveContext) => string
): DerivedColorDef => ({ key, label, group, derive });

/** Survol / actif : on tire la couleur vers le fond (équivalent de `hover:bg-primary/90` de shadcn). */
const hover = (role: string) => (c: DeriveContext) => mix(c.get(role), c.get("background"), 0.1);
const active = (role: string) => (c: DeriveContext) => mix(c.get(role), c.get("background"), 0.2);
const subtle = (role: string) => (c: DeriveContext) => mix(c.get("background"), c.get(role), 0.12);
const subtleForeground = (role: string) => (c: DeriveContext) =>
  mix(c.get(role), c.isLight ? "black" : "white", c.isLight ? 0.45 : 0.4);
const bordered = (role: string) => (c: DeriveContext) => mix(c.get("background"), c.get(role), 0.35);

const STATUS = [
  { id: "success", label: "Success", palette: "green" },
  { id: "warning", label: "Warning", palette: "amber" },
  { id: "info", label: "Info", palette: "blue" },
] as const;

const statusDefs = STATUS.flatMap(({ id, label, palette }) => [
  def(id, label, "status", (c) => (c.isLight ? tw(palette, "600") : tw(palette, "500"))),
  def(`${id}-foreground`, `${label} foreground`, "status", (c) => readableOn(c.get(id))),
  def(`${id}-hover`, `${label} hover`, "status", hover(id)),
  def(`${id}-active`, `${label} active`, "status", active(id)),
  def(`${id}-subtle`, `${label} subtle`, "status", subtle(id)),
  def(`${id}-subtle-foreground`, `${label} subtle text`, "status", subtleForeground(id)),
  def(`${id}-border`, `${label} border`, "status", bordered(id)),
]);

export const DERIVED_COLORS: DerivedColorDef[] = [
  ...statusDefs,
  def("destructive-hover", "Destructive hover", "status", hover("destructive")),
  def("destructive-active", "Destructive active", "status", active("destructive")),
  def("destructive-subtle", "Destructive subtle", "status", subtle("destructive")),
  def("destructive-subtle-foreground", "Destructive subtle text", "status", subtleForeground("destructive")),
  def("destructive-border", "Destructive border", "status", bordered("destructive")),

  def("primary-hover", "Primary hover", "states", hover("primary")),
  def("primary-active", "Primary active", "states", active("primary")),
  def("primary-subtle", "Primary subtle", "states", subtle("primary")),
  def("primary-subtle-foreground", "Primary subtle text", "states", (c) => c.get("primary")),
  def("secondary-hover", "Secondary hover", "states", hover("secondary")),
  def("secondary-active", "Secondary active", "states", active("secondary")),
  def("accent-hover", "Accent hover", "states", hover("accent")),
  def("accent-active", "Accent active", "states", active("accent")),
  def("muted-hover", "Muted hover", "states", hover("muted")),

  def("surface-sunken", "Sunken surface", "surfaces", (c) =>
    c.isLight ? mix(c.get("background"), c.get("foreground"), 0.03) : mix(c.get("background"), "black", 0.2)
  ),
  def("surface-raised", "Raised surface", "surfaces", (c) => c.get("card")),
  def("surface-overlay", "Overlay surface", "surfaces", (c) => c.get("popover")),
  def("surface-inverse", "Inverse surface", "surfaces", (c) => c.get("foreground")),
  def("surface-inverse-foreground", "Inverse surface text", "surfaces", (c) => c.get("background")),
  def("header", "Header", "surfaces", (c) => c.get("background")),
  def("header-foreground", "Header text", "surfaces", (c) => c.get("foreground")),
  def("header-border", "Header border", "surfaces", (c) => c.get("border")),
  def("footer", "Footer", "surfaces", (c) => c.get("background")),
  def("footer-foreground", "Footer text", "surfaces", (c) => c.get("muted-foreground")),
  def("footer-border", "Footer border", "surfaces", (c) => c.get("border")),
  def("card-border", "Card border", "surfaces", (c) => c.get("border")),
  def("popover-border", "Popover border", "surfaces", (c) => c.get("border")),
  def("tooltip", "Tooltip", "surfaces", (c) => c.get("foreground")),
  def("tooltip-foreground", "Tooltip text", "surfaces", (c) => c.get("background")),
  def("overlay", "Overlay (modal backdrop)", "surfaces", (c) =>
    c.isLight ? "oklch(0 0 0 / 0.45)" : "oklch(0 0 0 / 0.65)"
  ),
  def("scrim", "Scrim", "surfaces", () => "oklch(0 0 0 / 0.3)"),
  def("skeleton", "Skeleton", "surfaces", (c) => c.get("muted")),

  def("border-subtle", "Border subtle", "borders", (c) => mix(c.get("background"), c.get("border"), 0.5)),
  def("border-strong", "Border strong", "borders", (c) => mix(c.get("border"), c.get("foreground"), 0.3)),
  def("divider", "Divider", "borders", (c) => mix(c.get("background"), c.get("border"), 0.6)),
  def("border-focus", "Focus border", "borders", (c) => c.get("ring")),
  def("ring-offset", "Ring offset", "borders", (c) => c.get("background")),
  def("ring-destructive", "Destructive ring", "borders", (c) => mix(c.get("background"), c.get("destructive"), 0.5)),

  def("link", "Link", "text", (c) =>
    chromaOf(c.get("primary")) > 0.04 ? c.get("primary") : c.isLight ? tw("blue", "600") : tw("blue", "400")
  ),
  def("link-hover", "Link hover", "text", (c) => mix(c.get("link"), c.get("foreground"), 0.2)),
  def("link-visited", "Link visited", "text", (c) => (c.isLight ? tw("purple", "700") : tw("purple", "400"))),
  def("placeholder", "Placeholder", "text", (c) => c.get("muted-foreground")),
  def("selection", "Selection", "text", (c) => mix(c.get("background"), c.get("primary"), 0.25)),
  def("selection-foreground", "Selection text", "text", (c) => c.get("foreground")),
  def("highlight", "Highlight", "text", (c) =>
    c.isLight ? tw("yellow", "200") : mix(c.get("background"), tw("yellow", "400"), 0.35)
  ),
  def("highlight-foreground", "Highlight text", "text", (c) => c.get("foreground")),
  def("code-background", "Code background", "text", (c) => c.get("muted")),
  def("code-foreground", "Code text", "text", (c) => c.get("foreground")),
  def("disabled", "Disabled", "text", (c) => c.get("muted")),
  def("disabled-foreground", "Disabled text", "text", (c) => mix(c.get("muted"), c.get("muted-foreground"), 0.6)),

  def("chart-6", "Chart 6", "charts", (c) => (c.isLight ? tw("teal", "500") : tw("teal", "400"))),
  def("chart-7", "Chart 7", "charts", (c) => (c.isLight ? tw("amber", "500") : tw("amber", "400"))),
  def("chart-8", "Chart 8", "charts", (c) => (c.isLight ? tw("pink", "500") : tw("pink", "400"))),
  def("chart-grid", "Chart grid", "charts", (c) => c.get("border")),
  def("chart-axis", "Chart axis", "charts", (c) => c.get("muted-foreground")),

  def("sidebar-muted", "Sidebar muted", "sidebar", (c) => c.get("sidebar")),
  def("sidebar-muted-foreground", "Sidebar muted text", "sidebar", (c) => c.get("muted-foreground")),
  def("sidebar-hover", "Sidebar hover", "sidebar", (c) => c.get("sidebar-accent")),
  def("sidebar-active", "Sidebar active", "sidebar", (c) => c.get("sidebar-accent")),

  def("scrollbar-thumb", "Scrollbar thumb", "scrollbar", (c) => mix(c.get("background"), c.get("foreground"), 0.2)),
  def("scrollbar-track", "Scrollbar track", "scrollbar", () => "transparent"),
];

export const DERIVED_COLOR_KEYS = DERIVED_COLORS.map((d) => d.key);
export const DERIVED_COLOR_MAP: Record<string, DerivedColorDef> = Object.fromEntries(
  DERIVED_COLORS.map((d) => [d.key, d])
);

export { LIGHT_TEXT, DARK_TEXT };

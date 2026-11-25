"use client";

import { Bell, Check, Info, Search, Settings, TriangleAlert, X } from "lucide-react";
import React, { useMemo } from "react";

import { cn } from "@/lib/utils";
import type { ThemeStyles } from "@/types/theme";
import { kebab } from "@/utils/tokens/css-vars";
import { getPath, keysAt } from "@/utils/tokens/object-path";
import { resolveTheme } from "@/utils/tokens/resolve";

/**
 * Aperçu des tokens du squelette EGEN. Tout est rendu avec `var(--…)` : ce que l'on voit ici est
 * exactement ce que l'éditeur applique en live et ce qu'exportent le CSS et le JSON.
 */

const SCOPED_CSS = `
.tp-btn { transition: var(--motion-transition-colors); cursor: pointer; border: 0; }
.tp-primary { background: var(--primary); color: var(--primary-foreground); }
.tp-primary:hover { background: var(--primary-hover); }
.tp-primary:active { background: var(--primary-active); }
.tp-secondary { background: var(--secondary); color: var(--secondary-foreground); }
.tp-secondary:hover { background: var(--secondary-hover); }
.tp-destructive { background: var(--destructive); color: var(--destructive-foreground); }
.tp-destructive:hover { background: var(--destructive-hover); }
.tp-success { background: var(--success); color: var(--success-foreground); }
.tp-success:hover { background: var(--success-hover); }
.tp-ease { transition: transform var(--tp-duration, var(--motion-duration-slow)) var(--tp-ease, ease); }
.tp-ease-track:hover .tp-ease { transform: translateX(var(--tp-travel, 8rem)); }
.tp-link { color: var(--link); text-decoration: underline; }
.tp-link:hover { color: var(--link-hover); }
.tp-link:visited, .tp-visited { color: var(--link-visited); }
.tp-sel ::selection, .tp-sel::selection { background: var(--selection); color: var(--selection-foreground); }
`;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" data-tokens-section={title}>
      <div>
        <h3 className="text-muted-foreground text-sm font-semibold">{title}</h3>
        {hint && <p className="text-muted-foreground/70 text-xs">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground font-mono text-[10px]">{children}</span>
);

const STATUS = [
  { id: "success", label: "Success", Icon: Check },
  { id: "warning", label: "Warning", Icon: TriangleAlert },
  { id: "info", label: "Info", Icon: Info },
  { id: "destructive", label: "Destructive", Icon: X },
] as const;

export default function TokensPreview({ styles }: { styles: ThemeStyles }) {
  const { tokens } = useMemo(() => resolveTheme(styles), [styles]);
  const keys = (path: string[]) => keysAt(tokens, path);

  return (
    <div className="@container space-y-8 p-4" data-testid="tokens-preview">
      <style>{SCOPED_CSS}</style>

      <Section title="Status" hint="success · warning · info · destructive — subtle surface, border and solid action">
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
          {STATUS.map(({ id, label, Icon }) => (
            <div
              key={id}
              className="flex items-start gap-3 border p-3"
              style={{
                background: `var(--${id}-subtle)`,
                color: `var(--${id}-subtle-foreground)`,
                borderColor: `var(--${id}-border)`,
                borderRadius: "var(--radius-component-card)",
                borderWidth: "var(--border-component-card)",
              }}
              data-status={id}
            >
              <Icon style={{ width: "var(--icons-size-md)", height: "var(--icons-size-md)", strokeWidth: "var(--icons-stroke-width)" }} />
              <div className="min-w-0 flex-1">
                <div style={{ fontWeight: "var(--typography-font-weight-semibold)" }}>{label}</div>
                <div className="text-xs opacity-80">Subtle background, border and readable text.</div>
              </div>
              <button
                type="button"
                className={cn("tp-btn", id === "destructive" ? "tp-destructive" : `tp-${id}`)}
                style={{
                  ...(id === "warning" || id === "info"
                    ? { background: `var(--${id})`, color: `var(--${id}-foreground)` }
                    : {}),
                  height: "var(--component-button-height-sm)",
                  paddingInline: "var(--component-button-padding-x)",
                  borderRadius: "var(--component-button-radius)",
                  fontSize: "var(--typography-scale-button-size)",
                  fontWeight: "var(--typography-scale-button-weight)",
                }}
              >
                Action
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Interactive states" hint="hover and active are computed from the role color unless customized">
        <div className="flex flex-wrap gap-3">
          {(["primary", "secondary", "destructive", "success"] as const).map((role) => (
            <button
              key={role}
              type="button"
              className={cn("tp-btn", `tp-${role}`)}
              style={{
                height: "var(--component-button-height-md)",
                paddingInline: "var(--component-button-padding-x)",
                borderRadius: "var(--component-button-radius)",
                fontSize: "var(--typography-scale-button-size)",
                fontWeight: "var(--typography-scale-button-weight)",
              }}
            >
              {role} (hover me)
            </button>
          ))}
          <span className="tp-sel tp-link inline-flex items-center" style={{ fontSize: "var(--typography-scale-body-size)" }}>
            a link
          </span>
          <span style={{ background: "var(--highlight)", color: "var(--highlight-foreground)", padding: "0 0.25rem" }}>highlight</span>
          <span style={{ background: "var(--selection)", color: "var(--selection-foreground)", padding: "0 0.25rem" }}>selection</span>
          <span style={{ background: "var(--disabled)", color: "var(--disabled-foreground)", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-component-control)", opacity: "var(--opacity-disabled)" }}>disabled</span>
          <code style={{ background: "var(--code-background)", color: "var(--code-foreground)", fontFamily: "var(--typography-font-family-code)", padding: "0 0.25rem", borderRadius: "var(--radius-sm)" }}>code</code>
        </div>
      </Section>

      <Section title="Surfaces & layout" hint="sunken · raised · overlay · inverse, header, footer, tooltip and modal backdrop">
        <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          {(
            [
              ["Sunken", "surface-sunken", "foreground"],
              ["Raised", "surface-raised", "card-foreground"],
              ["Overlay", "surface-overlay", "popover-foreground"],
              ["Inverse", "surface-inverse", "surface-inverse-foreground"],
            ] as const
          ).map(([label, bg, fg]) => (
            <div
              key={bg}
              className="border p-3 text-sm"
              style={{ background: `var(--${bg})`, color: `var(--${fg})`, borderRadius: "var(--radius-component-card)", boxShadow: "var(--shadow-component-card)" }}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="overflow-hidden border" style={{ borderRadius: "var(--radius-component-card)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center justify-between border-b px-3 text-sm" style={{ background: "var(--header)", color: "var(--header-foreground)", borderColor: "var(--header-border)", height: "calc(var(--layout-header-height) * 0.7)" }}>
            <span>Header</span>
            <span className="flex gap-2">
              <Search className="size-4" />
              <Bell className="size-4" />
              <Settings className="size-4" />
            </span>
          </div>
          <div className="flex" style={{ height: "9rem" }}>
            <div className="border-r px-3 py-2 text-xs" style={{ background: "var(--sidebar)", color: "var(--sidebar-foreground)", borderColor: "var(--sidebar-border)", width: "calc(var(--layout-sidebar-width) * 0.6)" }}>
              <div style={{ background: "var(--sidebar-active)", color: "var(--sidebar-accent-foreground)", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-md)" }}>Active</div>
              <div style={{ background: "var(--sidebar-hover)", padding: "0.25rem 0.5rem", marginTop: "0.25rem", borderRadius: "var(--radius-md)", opacity: 0.8 }}>Hover</div>
              <div style={{ color: "var(--sidebar-muted-foreground)", padding: "0.25rem 0.5rem" }}>Muted</div>
            </div>
            <div className="relative flex-1 p-3 text-xs" style={{ paddingInline: "var(--layout-content-padding-x)" }}>
              Content area
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--overlay)" }}>
                <span className="px-2 py-1" style={{ background: "var(--tooltip)", color: "var(--tooltip-foreground)", borderRadius: "var(--radius-component-tooltip)", fontSize: "var(--component-tooltip-font-size)" }}>
                  Tooltip over overlay
                </span>
              </div>
            </div>
          </div>
          <div className="border-t px-3 py-1.5 text-xs" style={{ background: "var(--footer)", color: "var(--footer-foreground)", borderColor: "var(--footer-border)" }}>
            Footer
          </div>
        </div>
      </Section>

      <Section title="Borders & focus">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {(["border-subtle", "border", "border-strong", "border-focus", "ring-destructive"] as const).map((b) => (
            <div key={b} className="px-3 py-2" style={{ border: `var(--border-width-medium) var(--border-style) var(--${b})`, borderRadius: "var(--radius-md)" }}>
              {b}
            </div>
          ))}
          <div className="px-3 py-2" style={{ boxShadow: "var(--shadow-focus)", borderRadius: "var(--radius-md)" }}>
            focus ring
          </div>
          <div className="w-32" style={{ borderTop: "var(--border-component-divider) solid var(--divider)" }}>
            <Mono>divider</Mono>
          </div>
        </div>
      </Section>

      <Section title="Typography scale" hint="family · size · weight · line height · tracking per text style">
        <div className="space-y-2">
          {keys(["typography", "scale"]).map((key) => {
            const family = key.startsWith("h") || key === "display" ? "heading" : key === "code" ? "code" : "body";
            return (
              <div key={key} className="flex items-baseline gap-3 border-b pb-2" data-scale={key}>
                <Mono>{key}</Mono>
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{
                    fontFamily: `var(--typography-font-family-${family})`,
                    fontSize: `var(--typography-scale-${kebab(key)}-size)`,
                    fontWeight: `var(--typography-scale-${kebab(key)}-weight)` as never,
                    lineHeight: `var(--typography-scale-${kebab(key)}-line-height)`,
                    letterSpacing: `var(--typography-scale-${kebab(key)}-letter-spacing)`,
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-baseline gap-4">
          {keys(["typography", "fontWeight"]).map((w) => (
            <span key={w} style={{ fontWeight: `var(--typography-font-weight-${w})` as never }}>
              {w}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Radius" hint="the scale follows --radius unless a step is customized">
        <div className="flex flex-wrap gap-3">
          {keys(["radius"]).filter((k) => k !== "component").map((k) => (
            <div key={k} className="flex flex-col items-center gap-1">
              <div className="size-14 border" style={{ background: "var(--muted)", borderRadius: `var(--radius-${k})` }} />
              <Mono>{k}</Mono>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadows" hint="scale from the 6 shadow parameters · overrides and component aliases">
        <div className="flex flex-wrap gap-4">
          {["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "inner"].map((k) => (
            <div key={k} className="flex flex-col items-center gap-2">
              <div className="size-16" style={{ background: "var(--card)", borderRadius: "var(--radius-lg)", boxShadow: `var(--shadow-${k})` }} />
              <Mono>{k}</Mono>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motion" hint="hover a track: each dot uses the matching easing and the chosen duration">
        <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-2">
          {keys(["motion", "easing"]).map((k) => (
            <div key={k} className="tp-ease-track flex items-center gap-3 rounded-md border px-3 py-2" style={{ ["--tp-ease" as never]: `var(--motion-easing-${kebab(k)})` }}>
              <Mono>{k}</Mono>
              <div className="relative h-4 flex-1">
                <div className="tp-ease absolute top-0 size-4 rounded-full" style={{ background: "var(--primary)", ["--tp-travel" as never]: "calc(100% - 1rem)" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {keys(["motion", "duration"]).map((k) => (
            <Mono key={k}>
              {k}: {String(getPath(tokens, ["motion", "duration", k]))}
            </Mono>
          ))}
        </div>
      </Section>

      <Section title="Components" hint="sizes, spacing and radii from component tokens">
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2">
            {(["sm", "md", "lg"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="tp-btn tp-primary"
                style={{
                  height: `var(--component-button-height-${s})`,
                  paddingInline: "var(--component-button-padding-x)",
                  borderRadius: "var(--component-button-radius)",
                  gap: "var(--component-button-gap)",
                  fontWeight: "var(--component-button-font-weight)" as never,
                }}
              >
                Button {s}
              </button>
            ))}
            <input
              readOnly
              value="Input"
              aria-label="Input sample"
              style={{
                height: "var(--component-input-height)",
                paddingInline: "var(--component-input-padding-x)",
                border: "var(--component-input-border-width) solid var(--input)",
                borderRadius: "var(--component-input-radius)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
            <span
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                paddingInline: "var(--component-badge-padding-x)",
                paddingBlock: "var(--component-badge-padding-y)",
                fontSize: "var(--component-badge-font-size)",
                fontWeight: "var(--component-badge-font-weight)" as never,
                borderRadius: "var(--component-badge-radius)",
              }}
            >
              Badge
            </span>
          </div>
          <div
            className="border"
            style={{
              background: "var(--card)",
              color: "var(--card-foreground)",
              padding: "var(--component-card-padding)",
              borderWidth: "var(--component-card-border-width)",
              borderColor: "var(--card-border)",
              borderRadius: "var(--component-card-radius)",
              boxShadow: "var(--component-card-shadow)",
            }}
          >
            Card — padding, border, radius and shadow from tokens.
          </div>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <tbody>
              {["Row one", "Row two"].map((r) => (
                <tr key={r} className="border-b" style={{ height: "var(--component-table-row-height)" }}>
                  <td style={{ paddingInline: "var(--component-table-cell-padding-x)", paddingBlock: "var(--component-table-cell-padding-y)" }}>{r}</td>
                  <td style={{ fontWeight: "var(--component-table-header-font-weight)" as never }}>value</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ background: "var(--popover)", color: "var(--popover-foreground)", padding: "var(--component-toast-padding)", borderRadius: "var(--component-toast-radius)", boxShadow: "var(--shadow-component-toast)", maxWidth: "var(--component-toast-width)", border: "1px solid var(--popover-border)" }}>
            Toast — width, padding, radius and shadow.
          </div>
        </div>
      </Section>

      <Section title="Palette" hint="11-step ramps · derived from the theme colors until customized">
        <div className="space-y-2">
          {keys(["palette"]).map((name) => (
            <div key={name} className="flex items-center gap-3" data-ramp={name}>
              <span className="text-muted-foreground w-16 shrink-0 text-xs">{name}</span>
              <div className="grid flex-1 grid-cols-11 overflow-hidden rounded-md border">
                {keys(["palette", name]).map((shade) => (
                  <div key={shade} title={`${name}-${shade}`} className="h-6" style={{ background: `var(--palette-${name}-${shade})` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Effects, opacity, z-index & icons">
        <div className="flex flex-wrap gap-3">
          {keys(["effects", "blur"]).filter((k) => k !== "none").slice(0, 5).map((k) => (
            <div key={k} className="relative h-14 w-20 overflow-hidden rounded-md border" style={{ background: "repeating-linear-gradient(45deg, var(--primary) 0 6px, var(--accent) 6px 12px)" }}>
              <div className="absolute inset-2 flex items-center justify-center rounded text-[10px]" style={{ backdropFilter: `blur(var(--effects-blur-${k}))`, background: "color-mix(in oklab, var(--background) 40%, transparent)" }}>
                blur {k}
              </div>
            </div>
          ))}
          {keys(["opacity"]).map((k) => (
            <div key={k} className="flex h-14 w-20 items-center justify-center rounded-md text-[10px]" style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: `var(--opacity-${k})` }}>
              {k}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {keys(["icons", "size"]).map((k) => (
            <div key={k} className="flex flex-col items-center gap-1">
              <Settings style={{ width: `var(--icons-size-${k})`, height: `var(--icons-size-${k})`, strokeWidth: "var(--icons-stroke-width)" }} />
              <Mono>{k}</Mono>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {keys(["zIndex"]).map((k) => (
            <Mono key={k}>
              {k}: {String(getPath(tokens, ["zIndex", k]))}
            </Mono>
          ))}
        </div>
      </Section>
    </div>
  );
}

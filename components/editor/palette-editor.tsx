"use client";

import { RotateCcw } from "lucide-react";
import * as culori from "culori";

import { TooltipWrapper } from "@/components/tooltip-wrapper";
import { SHADES } from "@/utils/tokens/color-math";
import { hasPath } from "@/utils/tokens/object-path";
import type { ThemeTokens } from "@/types/theme";
import type { TokenTree } from "@/utils/tokens/object-path";

const PALETTE_LABELS: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  neutral: "Neutral",
  success: "Success",
  warning: "Warning",
  info: "Info",
  error: "Error",
};

const toHex = (value: string) => {
  try {
    return culori.formatHex(culori.parse(value) ?? "#000000") ?? "#000000";
  } catch {
    return "#000000";
  }
};

interface PaletteEditorProps {
  /** Rampes résolues : { primary: { "50": "...", ... }, ... } */
  palette: Record<string, Record<string, string>>;
  overrides: ThemeTokens | undefined;
  onChange: (path: string[], value: string) => void;
  onReset: (paths: string[][]) => void;
}

/** Éditeur de rampes 50 → 950 : une pastille par nuance, « Reset » régénère depuis la couleur du thème. */
export function PaletteEditor({ palette, overrides, onChange, onReset }: PaletteEditorProps) {
  return (
    <div className="space-y-3" data-testid="palette-editor">
      {Object.entries(palette).map(([name, ramp]) => {
        const customShades = SHADES.filter((shade) => hasPath(overrides as TokenTree, ["palette", name, shade]));
        return (
          <div key={name} data-palette={name}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium">
                {PALETTE_LABELS[name] ?? name}
                {customShades.length > 0 && <span className="text-foreground/70"> · {customShades.length} custom</span>}
              </span>
              {customShades.length > 0 && (
                <TooltipWrapper label="Regenerate this ramp" asChild>
                  <button
                    type="button"
                    onClick={() => onReset(customShades.map((shade) => ["palette", name, shade]))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Reset ${name} ramp`}
                  >
                    <RotateCcw className="size-3" />
                  </button>
                </TooltipWrapper>
              )}
            </div>
            <div className="grid grid-cols-11 overflow-hidden rounded-md border">
              {SHADES.map((shade) => (
                <label
                  key={shade}
                  title={`${name}-${shade}: ${ramp[shade]}`}
                  className="relative block h-7 cursor-pointer"
                  style={{ backgroundColor: ramp[shade] }}
                >
                  <input
                    type="color"
                    aria-label={`${name} ${shade}`}
                    value={toHex(ramp[shade])}
                    onChange={(e) => onChange(["palette", name, shade], e.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </label>
              ))}
            </div>
            <div className="text-muted-foreground mt-0.5 grid grid-cols-11 text-center text-[8px]">
              {SHADES.map((shade) => (
                <span key={shade}>{shade}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

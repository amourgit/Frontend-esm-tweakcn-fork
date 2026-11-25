"use client";

import { RotateCcw } from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";

import { TooltipWrapper } from "@/components/tooltip-wrapper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { TokenDefinition } from "@/utils/tokens/registry";

export type TokenValue = string | number | boolean;

const LENGTH_UNITS = ["px", "rem", "em", "%", "vh", "vw", "ch", "pt"];
const DURATION_UNITS = ["ms", "s"];
const EASING_PRESETS = [
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "cubic-bezier(0.4, 0, 0.2, 1)",
  "cubic-bezier(0.34, 1.56, 0.64, 1)",
  "cubic-bezier(0.2, 0, 0, 1)",
];

/** Champ texte à brouillon local : vider le champ ne remet pas la valeur par défaut avant la fin de la saisie. */
function DraftInput({
  value,
  onCommit,
  onEmpty,
  id,
  list,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onCommit: (value: string) => void;
  onEmpty?: () => void;
  id?: string;
  list?: string;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <Input
      id={id}
      list={list}
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      className={cn("h-7 px-2 font-mono text-xs", className)}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        if (draft.trim() === "") {
          onEmpty?.();
        } else {
          setDraft(value);
        }
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim() !== "") onCommit(e.target.value);
      }}
    />
  );
}

const splitUnit = (value: string, units: string[]) => {
  const match = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(value.trim());
  if (!match) return null;
  return { amount: match[1], unit: units.includes(match[2]) ? match[2] : units[0] };
};

function NumberUnitInput({
  value,
  units,
  onChange,
  id,
  step,
}: {
  value: string;
  units: string[];
  onChange: (value: string) => void;
  id: string;
  step: number;
}) {
  const parsed = splitUnit(value, units);
  if (!parsed) {
    // Valeur non numérique (calc(), var()…) : champ texte libre.
    return <DraftInput id={id} value={value} onCommit={onChange} />;
  }
  return (
    <div className="flex items-center gap-1">
      <DraftInput
        id={id}
        ariaLabel="value"
        value={parsed.amount}
        onCommit={(amount) => {
          if (/^-?\d*\.?\d+$/.test(amount.trim())) onChange(`${amount.trim()}${parsed.unit}`);
        }}
        className="w-16"
        placeholder={String(step)}
      />
      <Select value={parsed.unit} onValueChange={(unit) => onChange(`${parsed.amount}${unit}`)}>
        <SelectTrigger className="h-7 w-[4.25rem] px-2 text-xs" aria-label="unit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-99999">
          {units.map((unit) => (
            <SelectItem key={unit} value={unit} className="text-xs">
              {unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface TokenInputProps {
  definition: TokenDefinition;
  value: TokenValue;
  onChange: (value: TokenValue) => void;
  onEmpty: () => void;
  id: string;
}

export function TokenInput({ definition, value, onChange, onEmpty, id }: TokenInputProps) {
  const listId = useId();
  const text = String(value ?? "");

  switch (definition.kind) {
    case "boolean":
      return (
        <Switch id={id} checked={value === true || value === "true" || value === "1"} onCheckedChange={onChange} />
      );
    case "enum":
      return (
        <Select value={text} onValueChange={onChange}>
          <SelectTrigger id={id} className="h-7 w-full px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-99999">
            {(definition.options ?? []).map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "length":
      return (
        <NumberUnitInput id={id} value={text} units={LENGTH_UNITS} onChange={onChange} step={0.25} />
      );
    case "duration":
      return (
        <NumberUnitInput id={id} value={text} units={DURATION_UNITS} onChange={onChange} step={50} />
      );
    case "number": {
      const isNumeric = typeof definition.defaultValue === "number";
      return (
        <DraftInput
          id={id}
          value={text}
          className="w-24"
          onCommit={(next) => {
            if (!/^-?\d*\.?\d+$/.test(next.trim())) return;
            onChange(isNumeric ? Number(next) : next.trim());
          }}
          onEmpty={onEmpty}
        />
      );
    }
    case "easing":
      return (
        <>
          <DraftInput id={id} list={listId} value={text} onCommit={onChange} onEmpty={onEmpty} />
          <datalist id={listId}>
            {EASING_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
        </>
      );
    default:
      return (
        <DraftInput
          id={id}
          value={text}
          onCommit={onChange}
          onEmpty={onEmpty}
          placeholder={definition.optional ? "auto" : undefined}
        />
      );
  }
}

interface TokenRowProps {
  definition: TokenDefinition;
  value: TokenValue | undefined;
  overridden: boolean;
  onChange: (path: string[], value: TokenValue) => void;
  onReset: (paths: string[][]) => void;
}

export function TokenRow({ definition, value, overridden, onChange, onReset }: TokenRowProps) {
  const id = `token-${definition.id}`;
  return (
    <div className="flex items-center gap-2 py-1" data-token={definition.id}>
      <Label
        htmlFor={id}
        title={definition.cssVar}
        className="text-muted-foreground w-28 shrink-0 truncate text-[11px] font-medium"
      >
        {definition.label}
      </Label>
      <div className="min-w-0 flex-1">
        <TokenInput
          id={id}
          definition={definition}
          value={value ?? ""}
          onChange={(next) => onChange(definition.path, next)}
          onEmpty={() => onReset([definition.path])}
        />
      </div>
      <div className="w-5 shrink-0">
        {overridden && (
          <TooltipWrapper label="Reset to default" asChild>
            <button
              type="button"
              onClick={() => onReset([definition.path])}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Reset ${definition.label}`}
            >
              <RotateCcw className="size-3" />
            </button>
          </TooltipWrapper>
        )}
      </div>
    </div>
  );
}

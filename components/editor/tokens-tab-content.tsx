"use client";

import { RotateCcw, Search, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import ControlSection from "@/components/editor/control-section";
import { PaletteEditor } from "@/components/editor/palette-editor";
import { TokenRow, type TokenValue } from "@/components/editor/token-control";
import { TooltipWrapper } from "@/components/tooltip-wrapper";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ThemeTokens } from "@/types/theme";
import { getPath, hasPath, type TokenTree } from "@/utils/tokens/object-path";
import { getTokenGroups } from "@/utils/tokens/registry";

interface TokensTabContentProps {
  /** Tokens résolus (défauts du squelette + dérivations + overrides du thème). */
  resolvedTokens: TokenTree;
  /** Overrides propres au thème (arbre partiel). */
  overrides: ThemeTokens | undefined;
  updateToken: (path: string[], value: TokenValue) => void;
  resetTokens: (paths: string[][]) => void;
}

export function TokensTabContent({ resolvedTokens, overrides, updateToken, resetTokens }: TokensTabContentProps) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => getTokenGroups(), []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups.map((g) => ({ ...g, forceOpen: false }));
    return groups
      .map((group) => ({
        ...group,
        forceOpen: true,
        subgroups: group.subgroups
          .map((sub) => ({
            ...sub,
            tokens: sub.tokens.filter(
              (t) =>
                t.id.toLowerCase().includes(query) ||
                t.label.toLowerCase().includes(query) ||
                t.cssVar.includes(query) ||
                sub.title.toLowerCase().includes(query) ||
                group.title.toLowerCase().includes(query)
            ),
          }))
          .filter((sub) => sub.tokens.length > 0),
      }))
      .filter((group) => group.subgroups.length > 0);
  }, [groups, search]);

  const customCount = (paths: string[][]) =>
    paths.filter((p) => hasPath(overrides as TokenTree, p)).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pb-3">
        <div className="bg-muted/50 flex items-center gap-2.5 rounded-lg border px-3">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tokens (e.g. sidebar, duration, --radius)..."
            aria-label="Search tokens"
            className="text-foreground placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4">
        {filtered.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-xs">No tokens found</p>
        )}
        {filtered.map((group) => {
          const allPaths = group.subgroups.flatMap((s) => s.tokens.map((t) => t.path));
          const custom = customCount(allPaths);
          return (
            <ControlSection
              key={`${group.id}-${group.forceOpen}`}
              title={`${group.title} (${group.count})`}
              expanded={group.forceOpen}
              headerAction={
                custom > 0 ? (
                  <TooltipWrapper label={`Reset ${custom} customized token(s) in this group`} asChild>
                    <button
                      type="button"
                      onClick={() => resetTokens(allPaths.filter((p) => hasPath(overrides as TokenTree, p)))}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-1 text-[11px]"
                      aria-label={`Reset ${group.title}`}
                    >
                      <RotateCcw className="size-3" />
                      {custom}
                    </button>
                  </TooltipWrapper>
                ) : undefined
              }
            >
              <p className="text-muted-foreground mb-1 text-[11px]">{group.description}</p>
              {group.id === "palette" ? (
                <PaletteEditor
                  palette={(resolvedTokens.palette ?? {}) as Record<string, Record<string, string>>}
                  overrides={overrides}
                  onChange={(path, value) => updateToken(path, value)}
                  onReset={resetTokens}
                />
              ) : (
                group.subgroups.map((sub) => (
                  <div key={sub.title} className="mb-2">
                    {group.subgroups.length > 1 && (
                      <div className="text-foreground/70 mt-1 mb-0.5 text-[11px] font-semibold">{sub.title}</div>
                    )}
                    {sub.tokens.map((token) => (
                      <TokenRow
                        key={token.id}
                        definition={token}
                        value={getPath(resolvedTokens, token.path) as TokenValue | undefined}
                        overridden={hasPath(overrides as TokenTree, token.path)}
                        onChange={updateToken}
                        onReset={resetTokens}
                      />
                    ))}
                  </div>
                ))
              )}
            </ControlSection>
          );
        })}
      </ScrollArea>
    </div>
  );
}

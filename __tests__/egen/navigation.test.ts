import { describe, expect, it } from "vitest";

import { currentPath, safeGotoPath } from "@/lib/egen/navigation";

describe("currentPath : page courante annoncée au Core", () => {
  it("chemin seul, avec requête, et valeurs par défaut", () => {
    expect(currentPath("/editor/theme", "")).toBe("/editor/theme");
    expect(currentPath("/editor/theme", "?tab=colors")).toBe("/editor/theme?tab=colors");
    expect(currentPath("/themes", "sort=new")).toBe("/themes?sort=new");
    expect(currentPath(null, null)).toBe("/");
    expect(currentPath("relatif", undefined)).toBe("/");
  });
});

describe("safeGotoPath : navigation demandée par le Core", () => {
  it("accepte uniquement les chemins internes", () => {
    expect(safeGotoPath("/editor/theme?x=1")).toBe("/editor/theme?x=1");
    expect(safeGotoPath("/")).toBe("/");
  });

  it.each(["https://evil.example", "//evil.example", "javascript:alert(1)", "\\\\evil", "/a\\b", "", 42, null, undefined])(
    "refuse %j",
    (value) => {
      expect(safeGotoPath(value)).toBeNull();
    }
  );
});

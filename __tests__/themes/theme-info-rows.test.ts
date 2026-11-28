import { describe, expect, it } from "vitest";
import type { ThemeDetails } from "@/lib/themes/types";
import { buildThemeInfoRows, describeVersion } from "@/components/editor/theme-info/rows";

const base: ThemeDetails = {
  id: "t1",
  name: "Mon thème",
  description: null,
  source: "USER",
  isDefault: false,
  author: { type: "user", id: "u1", name: "Kim" },
  derivedFrom: null,
  metadata: {},
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-02T10:00:00Z"),
  currentRevision: 5,
  revisionCount: 5,
  currentVersion: 2,
  versionCount: 2,
  latestVersionRevision: 3,
  unreleasedRevisions: 2,
  lastModifiedBy: "Kim",
};
const fmt = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const get = (rows: ReturnType<typeof buildThemeInfoRows>, label: string) => rows.find((r) => r.label === label)?.value;

describe("fiche d'identité : lignes affichées", () => {
  it("décrit la version et les états non publiés sans ambiguïté", () => {
    expect(describeVersion({ currentVersion: null, unreleasedRevisions: 1 })).toBe("No version yet");
    expect(describeVersion({ currentVersion: 2, unreleasedRevisions: 0 })).toBe("v2");
    expect(describeVersion({ currentVersion: 2, unreleasedRevisions: 1 })).toBe("v2 + 1 unreleased state");
    expect(describeVersion({ currentVersion: 2, unreleasedRevisions: 3 })).toBe("v2 + 3 unreleased states");
  });

  it("affiche nom, type, auteur, version, état, dates", () => {
    const rows = buildThemeInfoRows(base, fmt);
    expect(get(rows, "Name")).toBe("Mon thème");
    expect(get(rows, "Type")).toBe("Your theme");
    expect(get(rows, "Author")).toBe("Kim");
    expect(get(rows, "Version")).toBe("v2 + 2 unreleased states");
    expect(get(rows, "Versions")).toBe("2");
    expect(get(rows, "Current state")).toBe("State 5 of 5");
    expect(get(rows, "Created")).toBe("2026-11-01");
    expect(get(rows, "Last modified")).toBe("2026-11-02 by Kim");
    expect(get(rows, "Derived from")).toBeUndefined();
    expect(get(rows, "Description")).toBeUndefined();
  });

  it("thème système par défaut : auteur système, lecture seule, pas d'auteur de modification", () => {
    const rows = buildThemeInfoRows(
      { ...base, name: "Default", source: "BUILT_IN", isDefault: true, author: { type: "system", id: null, name: "system" }, lastModifiedBy: "system", currentVersion: 1, versionCount: 1, unreleasedRevisions: 0, currentRevision: 1, revisionCount: 1 },
      fmt
    );
    expect(get(rows, "Name")).toBe("Default (default theme)");
    expect(get(rows, "Type")).toBe("System theme (read-only)");
    expect(get(rows, "Author")).toBe("System");
    expect(get(rows, "Version")).toBe("v1");
    expect(get(rows, "Last modified")).toBe("2026-11-02");
  });

  it("affiche la provenance et la description d'une copie dérivée", () => {
    const rows = buildThemeInfoRows(
      { ...base, description: "Pour la marque", derivedFrom: { themeId: "modern-minimal", themeName: "Modern Minimal", revision: 1, version: 1 } },
      fmt
    );
    expect(get(rows, "Derived from")).toBe("Modern Minimal (state 1, v1)");
    expect(get(rows, "Description")).toBe("Pour la marque");
  });
});

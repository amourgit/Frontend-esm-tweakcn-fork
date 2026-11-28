import type { ThemeDetails } from "@/lib/themes/types";
import { formatDateTime } from "../theme-history/labels";

export interface ThemeInfoRow {
  label: string;
  value: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Version affichée : « v2 », avec le nombre d'états enregistrés depuis (« + 3 unreleased states »). */
export function describeVersion(d: Pick<ThemeDetails, "currentVersion" | "unreleasedRevisions">): string {
  if (d.currentVersion === null) return "No version yet";
  return d.unreleasedRevisions > 0
    ? `v${d.currentVersion} + ${plural(d.unreleasedRevisions, "unreleased state")}`
    : `v${d.currentVersion}`;
}

/** Lignes de la fiche d'identité d'un thème (fonction pure : la mise en page est ailleurs). */
export function buildThemeInfoRows(
  d: ThemeDetails,
  format: (value: Date | string) => string = formatDateTime
): ThemeInfoRow[] {
  const rows: ThemeInfoRow[] = [
    { label: "Name", value: d.isDefault ? `${d.name} (default theme)` : d.name },
    { label: "Type", value: d.source === "BUILT_IN" ? "System theme (read-only)" : "Your theme" },
    { label: "Author", value: d.author.type === "system" ? "System" : d.author.name },
    { label: "Version", value: describeVersion(d) },
    { label: "Versions", value: String(d.versionCount) },
    { label: "Current state", value: `State ${d.currentRevision} of ${d.revisionCount}` },
    { label: "Created", value: format(d.createdAt) },
    {
      label: "Last modified",
      value: d.lastModifiedBy && d.lastModifiedBy !== "system"
        ? `${format(d.updatedAt)} by ${d.lastModifiedBy}`
        : format(d.updatedAt),
    },
  ];
  if (d.derivedFrom) {
    const { themeName, revision, version } = d.derivedFrom;
    rows.push({
      label: "Derived from",
      value: `${themeName} (state ${revision}${version !== null ? `, v${version}` : ""})`,
    });
  }
  if (d.description) rows.push({ label: "Description", value: d.description });
  return rows;
}

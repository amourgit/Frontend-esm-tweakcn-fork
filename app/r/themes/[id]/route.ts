import { NextResponse } from "next/server";

import { getTheme } from "@/actions/themes";
import { generateThemeRegistryItemFromStyles } from "@/utils/registry/themes";
import { registryItemSchema } from "shadcn/schema";
import { getBuiltInThemeStyles } from "@/utils/theme-preset-helper";
import { ThemeStyles } from "@/types/theme";

// Les thèmes sont versionnés en base : la réponse doit refléter la version courante (pas de rendu statique figé).
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  // `<id>.json` : item shadcn standard ; `<id>.complete.json` : + squelette EGEN (couleurs étendues, tokens)
  const withoutExt = rawId.replace(/\.json$/, "");
  const scope = withoutExt.endsWith(".complete") ? "complete" : "standard";
  const id = scope === "complete" ? withoutExt.slice(0, -".complete".length) : rawId;

  try {
    // Thèmes système ET thèmes utilisateur : tout vient de la base (version courante).
    let themeName: string;
    let themeStyles: ThemeStyles;
    try {
      const theme = await getTheme(id.replace(/\.json$/, ""));
      themeName = theme.name;
      themeStyles = theme.styles;
    } catch (error) {
      if ((error as Error).name !== "ThemeNotFoundError") throw error;
      // Base pas encore initialisée : repli sur le fichier source des thèmes livrés.
      const builtInTheme = getBuiltInThemeStyles(id.replace(/\.json$/, ""));
      if (!builtInTheme) throw error;
      themeName = builtInTheme.name;
      themeStyles = builtInTheme.styles;
    }

    const generatedRegistryItem = generateThemeRegistryItemFromStyles(themeName, themeStyles, scope);

    // Validate the generated registry item against the official shadcn registry item schema
    // https://ui.shadcn.com/docs/registry/registry-item-json
    const parsedRegistryItem = registryItemSchema.safeParse(generatedRegistryItem);
    if (!parsedRegistryItem.success) {
      console.error(
        "Could not parse the registry item from the database:",
        parsedRegistryItem.error.format()
      );

      return new NextResponse("Unexpected registry item format.", {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // If the parsing is successful, we can safely access the data property
    // and return it as the registry item json being sure it's in a correct format.
    const registryItem = parsedRegistryItem.data;
    return new NextResponse(JSON.stringify(registryItem), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    if ((e as Error).name === "ThemeNotFoundError") {
      return new NextResponse("Theme not found.", { status: 404 });
    }
    console.error("Error fetching the theme registry item:", e);

    return new NextResponse("Failed to fetch the theme registry item.", {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

import { getBuiltInThemes, getTheme } from "@/actions/themes";
import { ThemeCatalogProvider } from "@/components/theme-catalog-provider";
import Editor from "@/components/editor/editor";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/site";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — Theme Editor`,
  description: PRODUCT_DESCRIPTION,
};

export default async function EditorPage({ params }: { params: Promise<{ themeId: string[] }> }) {
  const { themeId } = await params;
  const themePromise = themeId?.length > 0 ? getTheme(themeId?.[0]) : Promise.resolve(null);
  // Les thèmes système viennent de la base (importés au démarrage), plus du fichier de presets.
  const builtInThemes = await getBuiltInThemes();

  return (
    <ThemeCatalogProvider builtInThemes={builtInThemes}>
      <Editor themePromise={themePromise} />
    </ThemeCatalogProvider>
  );
}

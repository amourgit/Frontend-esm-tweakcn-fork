import { getSystemThemes, getThemeForEditor } from "@/actions/themes";
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
  const themePromise = themeId?.length > 0 ? getThemeForEditor(themeId?.[0]) : Promise.resolve(null);
  // Les thèmes système (dont le thème par défaut) viennent de la base, plus du fichier de presets.
  const systemThemes = await getSystemThemes();

  return (
    <ThemeCatalogProvider systemThemes={systemThemes}>
      <Editor themePromise={themePromise} />
    </ThemeCatalogProvider>
  );
}

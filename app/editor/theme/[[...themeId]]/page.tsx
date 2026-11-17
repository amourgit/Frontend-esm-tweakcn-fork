import { getTheme } from "@/actions/themes";
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

  return <Editor themePromise={themePromise} />;
}

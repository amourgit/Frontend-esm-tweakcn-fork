import { redirect } from "next/navigation";

// Pas de page d'accueil : le service ouvre directement l'éditeur de thèmes.
export default function RootPage() {
  redirect("/editor/theme");
}

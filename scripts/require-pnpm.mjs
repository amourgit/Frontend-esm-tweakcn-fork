// Garde-fou d'installation : ce projet s'installe uniquement avec pnpm.
const agent = process.env.npm_config_user_agent ?? "";
if (!agent.startsWith("pnpm/")) {
  console.error(
    [
      "",
      "  Ce projet s'installe uniquement avec pnpm (le lockfile est pnpm-lock.yaml).",
      "",
      "  Commandes :",
      "    corepack enable",
      "    pnpm install --frozen-lockfile",
      "",
    ].join("\n")
  );
  process.exit(1);
}

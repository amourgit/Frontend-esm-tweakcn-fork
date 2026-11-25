import crypto from "crypto";
import goldenJson from "./../golden/standard-exports.json";

export const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
/** Empreintes de l'export standard produit AVANT l'intégration du squelette (référence de non-régression). */
export const golden = goldenJson as Record<string, string>;

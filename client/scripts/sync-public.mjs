// Copies the repo-level /public and /assets folders into client/public so the
// monorepo keeps a single source of truth for static files.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const target = join(here, "..", "public");
mkdirSync(target, { recursive: true });
for (const dir of ["public", "assets"]) {
  const src = join(root, dir);
  if (!existsSync(src)) continue;
  cpSync(src, dir === "public" ? target : join(target, "assets"), { recursive: true });
}
console.log("[sync-public] static assets ready");

import { rmSync } from "node:fs";
import { resolve } from "node:path";

/** Começa cada execução com dados de teste vazios. Roda uma vez, antes de subir os servidores. */
export default function globalSetup() {
  if (!process.env.PW_KEEP_DATA) rmSync(resolve(import.meta.dirname, "..", ".data-test"), { recursive: true, force: true });
}

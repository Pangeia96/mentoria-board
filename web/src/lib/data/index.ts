import { fakeData } from "./fake";
import type { DataLayer } from "./types";

/** Ponto único de troca: no /replica-backend isto passa a devolver a implementação Supabase. */
export const data: DataLayer = fakeData;
export type * from "./types";

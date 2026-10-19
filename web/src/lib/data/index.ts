import { hasSupabase } from "../supabase/server";
import { fakeData } from "./fake";
import { supabaseData } from "./supabase";
import type { DataLayer } from "./types";

/** Supabase quando as chaves estão no .env.local; senão a camada fake (JSON local). */
export const data: DataLayer = hasSupabase ? supabaseData : fakeData;
export type * from "./types";

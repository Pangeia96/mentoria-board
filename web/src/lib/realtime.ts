import "server-only";

/** Chama o servidor de tempo real (POST /kick ou /notify). Se falhar, o recheck periódico cobre o /kick. */
export async function realtimeCall(path: "kick" | "notify", boardId: string, extra: Record<string, string> = {}) {
  const base = process.env.REALTIME_HTTP_URL ?? (process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:1234").replace(/^ws/, "http");
  const qs = new URLSearchParams({ board: boardId, ...extra });
  try {
    await fetch(`${base}/${path}?${qs}`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789"}` },
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    console.error(`[realtime] /${path} não respondeu`);
  }
}

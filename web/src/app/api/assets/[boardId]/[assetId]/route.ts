import { NextResponse, type NextRequest } from "next/server";
import { data } from "@/lib/data";
import { actorForBoard } from "@/lib/auth";

const UUID = /^[0-9a-f-]{36}$/i;

/** Serve uma imagem do quadro só para quem tem acesso a ele (mentor ou visitante com cookie válido). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/assets/[boardId]/[assetId]">) {
  const { boardId, assetId } = await ctx.params;
  if (!UUID.test(boardId) || !UUID.test(assetId)) return new NextResponse(null, { status: 404 });
  if (!(await actorForBoard(boardId))) return new NextResponse(null, { status: 403 });
  const found = await data.readAsset(boardId, assetId);
  if (!found) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(found.bytes), {
    headers: {
      "content-type": found.asset.mimeType,
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

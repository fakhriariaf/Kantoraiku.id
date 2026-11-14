import { authDevice, handle, uploadCover } from "@/server/device";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => uploadCover(await authDevice(req), (await ctx.params).id, req));
}

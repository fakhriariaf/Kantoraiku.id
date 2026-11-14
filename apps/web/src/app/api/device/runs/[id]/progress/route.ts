import { authDevice, handle, progress } from "@/server/device";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => progress(await authDevice(req), (await ctx.params).id, await req.json()));
}

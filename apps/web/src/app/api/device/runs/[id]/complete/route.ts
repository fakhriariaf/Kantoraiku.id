import { authDevice, complete, handle } from "@/server/device";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => complete(await authDevice(req), (await ctx.params).id, await req.json()));
}

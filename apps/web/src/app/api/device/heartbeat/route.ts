import { authDevice, handle, heartbeat } from "@/server/device";

export async function POST(req: Request) {
  return handle(async () => heartbeat(await authDevice(req), await req.json()));
}

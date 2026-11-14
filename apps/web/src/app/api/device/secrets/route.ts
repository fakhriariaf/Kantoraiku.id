import { authDevice, deviceSecrets, handle } from "@/server/device";

export async function POST(req: Request) {
  return handle(async () => deviceSecrets(await authDevice(req)));
}

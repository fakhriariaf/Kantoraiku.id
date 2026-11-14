import { authDevice, claim, handle } from "@/server/device";

/** 200 + paket kerja, atau 204 bila tidak ada pekerjaan. */
export async function POST(req: Request) {
  return handle(async () => claim(await authDevice(req)));
}

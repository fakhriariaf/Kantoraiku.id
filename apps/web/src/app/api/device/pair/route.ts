import { handle, pair } from "@/server/device";

/** Tukar kode setup -> token perangkat. Satu-satunya route perangkat tanpa Bearer token. */
export async function POST(req: Request) {
  return handle(async () => pair(await req.json()));
}

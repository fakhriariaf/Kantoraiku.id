import { handle, pair } from "@/server/device";
import { allowRequest } from "@/server/rate-limit";

/** Tukar kode setup -> token perangkat. Satu-satunya route perangkat tanpa Bearer token. */
export async function POST(req: Request) {
  if (!(await allowRequest(req, "pair", 10, 600))) {
    return Response.json({ error: "Terlalu banyak percobaan pairing. Tunggu 10 menit." }, { status: 429 });
  }
  return handle(async () => pair(await req.json()));
}

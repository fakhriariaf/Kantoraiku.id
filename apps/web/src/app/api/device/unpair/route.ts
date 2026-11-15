import { authDevice, handle } from "@/server/device";
import { revokeDevice } from "@/server/office";

/** Aplikasi konektor memutuskan dirinya sendiri (tombol "Putuskan PC ini"). */
export async function POST(req: Request) {
  return handle(async () => {
    const dev = await authDevice(req);
    await revokeDevice(dev.office_id, dev.id, "pc");
    return null;
  });
}

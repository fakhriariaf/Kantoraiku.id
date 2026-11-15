import { redirect } from "next/navigation";

type P = { params: Promise<{ slug: string }> };

/** Persetujuan kini tab "Perlu keputusan" di menu Konten; alamat lama tetap berfungsi. */
export default async function ApprovalsRedirect({ params }: P) {
  const { slug } = await params;
  redirect(`/o/${slug}/konten`);
}

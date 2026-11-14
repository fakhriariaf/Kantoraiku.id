import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { ACTIVATION_LIMIT_HOURS, PC_MINIMUM, REFUND_DAYS } from "@/lib/offer";
import { config, hasRealWhatsapp } from "@/server/config";

export const metadata: Metadata = { title: "Kebijakan Refund · Kantoraiku" };

export default function KebijakanRefundPage() {
  return (
    <LegalPage
      path="/kebijakan-refund"
      title="Kebijakan Refund"
      summary="Kapan uang kamu kembali, berapa besarnya, dan bagaimana cara memintanya."
    >
      <h2>1. Garansi {REFUND_DAYS} hari</h2>
      <p>
        Kamu bisa meminta pengembalian dana penuh dalam {REFUND_DAYS} hari sejak kantor aktif bila konektor tidak bisa
        berjalan di PC kamu, dengan dua syarat:
      </p>
      <ul>
        <li>PC memenuhi syarat minimum: {PC_MINIMUM};</li>
        <li>kamu sudah mencoba memasang konektor bersama kami, dan masalahnya tidak berhasil kami selesaikan.</li>
      </ul>

      <h2>2. Pengembalian penuh lainnya</h2>
      <ul>
        <li>Kantor belum aktif {ACTIVATION_LIMIT_HOURS / 24} x 24 jam setelah kamu mengirim bukti transfer yang benar.</li>
        <li>Kamu membayar lebih dari sekali untuk pesanan yang sama. Kelebihannya kami kembalikan.</li>
        <li>Kami tidak bisa memproses pesanan kamu, misalnya karena alamat kantor sudah terpakai saat pembayaran masuk.</li>
      </ul>

      <h2>3. Yang tidak dikembalikan</h2>
      <ul>
        <li>Permintaan yang masuk lebih dari {REFUND_DAYS} hari sejak kantor aktif.</li>
        <li>Alasan di luar masalah teknis setelah kantor berjalan normal, misalnya berubah pikiran.</li>
        <li>Biaya pihak ketiga yang kamu bayar langsung, misalnya tagihan penyedia AI.</li>
        <li>
          Kantor yang dibekukan atau ditutup karena melanggar <Link href="/syarat-ketentuan">Syarat &amp; Ketentuan</Link>.
        </li>
      </ul>

      <h2>4. Cara mengajukan</h2>
      <ol>
        <li>
          Kirim email ke <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>
          {hasRealWhatsapp() && (
            <>
              {" "}
              atau WhatsApp ke <a href={`https://wa.me/${config.adminWhatsapp}`}>+{config.adminWhatsapp}</a>
            </>
          )}{" "}
          dengan kode pesanan dan alasan singkat.
        </li>
        <li>Untuk masalah konektor, sertakan versi Windows dan pesan error yang muncul.</li>
        <li>Kami membalas dalam 2 hari kerja. Bila disetujui, dana ditransfer ke rekening pengirim dalam 7 hari kerja.</li>
        <li>
          Setelah dana dikembalikan, kantor kamu ditutup dan isinya dihapus sesuai{" "}
          <Link href="/kebijakan-privasi">Kebijakan Privasi</Link>.
        </li>
      </ol>

      <h2>5. Pembayaran lewat Midtrans</h2>
      <p>
        Setelah pembayaran QRIS, virtual account, dan e-wallet tersedia, pengembalian untuk metode itu dikirim lewat jalur
        pembayaran yang sama bila memungkinkan, atau ke rekening yang kamu tunjuk.
      </p>
    </LegalPage>
  );
}

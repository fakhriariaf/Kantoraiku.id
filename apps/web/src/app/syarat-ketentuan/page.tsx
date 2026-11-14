import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, legalEntity } from "@/components/legal/legal-page";
import { config, publicDomain } from "@/server/config";

export const metadata: Metadata = { title: "Syarat & Ketentuan · Kantoraiku" };

export default function SyaratKetentuanPage() {
  const domain = publicDomain();
  return (
    <LegalPage
      path="/syarat-ketentuan"
      title="Syarat & Ketentuan"
      summary="Aturan pemakaian Kantoraiku: apa yang kamu beli, apa tanggung jawab kamu, dan apa tanggung jawab kami."
    >
      <h2>1. Tentang layanan</h2>
      <p>
        Kantoraiku dikelola oleh {legalEntity()} (&ldquo;kami&rdquo;). Layanan ini terdiri dari dua bagian: dashboard
        web di {domain} dan konektor yang kamu pasang di PC kamu. Agent AI menjalankan tugas di PC kamu memakai akun dan
        API key penyedia AI milik kamu. Dashboard menyimpan pengaturan kantor dan hasil kerja agent.
      </p>
      <p>
        Dengan membuat pesanan atau memakai Kantoraiku, kamu menyetujui ketentuan ini dan{" "}
        <Link href="/kebijakan-privasi">Kebijakan Privasi</Link>.
      </p>

      <h2>2. Pesanan dan pembayaran</h2>
      <ul>
        <li>Harga yang berlaku adalah harga yang tampil saat kamu membuat pesanan. Kamu membayar sekali, tanpa biaya bulanan dari kami.</li>
        <li>
          Pesanan dengan transfer bank harus dibayar dalam {config.manualPaymentHours} jam. Setelah itu pesanan kedaluwarsa dan
          alamat kantornya bisa dipilih orang lain.
        </li>
        <li>
          Kantor aktif setelah pembayaran kami konfirmasi. Pengembalian dana diatur dalam{" "}
          <Link href="/kebijakan-refund">Kebijakan Refund</Link>.
        </li>
      </ul>

      <h2>3. Arti &ldquo;lifetime&rdquo;</h2>
      <p>
        Kamu bisa memakai kantor kamu tanpa biaya tambahan dari kami selama Kantoraiku masih beroperasi, termasuk pembaruan
        dan fitur baru yang kami rilis. Bila Kantoraiku akan berhenti beroperasi, kami memberi tahu lewat email paling
        lambat 30 hari sebelumnya, dan kamu bisa meminta salinan data kantor kamu selama masa itu.
      </p>

      <h2>4. Akun, alamat kantor, dan perangkat</h2>
      <ul>
        <li>Data yang kamu isi saat membeli harus benar, terutama email: link masuk dan reset password dikirim ke sana.</li>
        <li>Alamat kantor (nama-kantor.{domain}) dipilih saat membeli dan tidak bisa diganti.</li>
        <li>Satu pembelian mencakup satu kantor dan satu PC yang terhubung. PC bisa dicabut dan diganti dari dashboard.</li>
        <li>
          Kamu bertanggung jawab menjaga password kantor, kode setup, dan PC tempat konektor terpasang. Kabari kami bila
          kamu menduga ada orang lain yang masuk ke kantor kamu.
        </li>
      </ul>

      <h2>5. Penyedia AI dan biayanya</h2>
      <p>
        Agent memakai penyedia AI (saat ini OpenAI dan Anthropic) lewat API key milik kamu. Tagihan, batas pemakaian, dan aturan penyedia
        itu adalah urusan antara kamu dan penyedia tersebut. Kami tidak menjual kuota AI dan tidak bertanggung jawab atas
        tagihan dari penyedia.
      </p>

      <h2>6. Konten yang dihasilkan</h2>
      <ul>
        <li>Topik, naskah, dan hasil kerja agent lainnya adalah milik kamu.</li>
        <li>
          AI bisa keliru. Periksa fakta, sumber, dan hak cipta sebelum memakai atau memposting hasilnya. Tanggung jawab atas
          konten yang kamu terbitkan ada pada kamu.
        </li>
        <li>Mode otomatis melewati pemeriksaan kamu. Pakai hanya untuk channel yang hasilnya sudah kamu percayai.</li>
      </ul>

      <h2>7. Yang tidak boleh dilakukan</h2>
      <ul>
        <li>membuat atau menyebarkan konten yang melanggar hukum Indonesia, menipu, atau melanggar hak orang lain;</li>
        <li>mengirim spam atau memakai Kantoraiku untuk mengganggu orang lain;</li>
        <li>mencoba masuk ke kantor, data, atau perangkat milik pengguna lain;</li>
        <li>
          membebani atau menyerang server Kantoraiku. Bila kamu menemukan celah keamanan, laporkan ke{" "}
          <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> dan jangan memanfaatkannya;
        </li>
        <li>menjual ulang atau menyewakan akses kantor tanpa izin tertulis dari kami.</li>
      </ul>
      <p>
        Pelanggaran bisa membuat kantor kamu dibekukan. Untuk pelanggaran berat, kami bisa menutup kantor tanpa
        pengembalian dana.
      </p>

      <h2>8. Ketersediaan layanan</h2>
      <p>
        Kami berusaha menjaga dashboard tetap bisa dibuka, tetapi gangguan dan pemeliharaan bisa terjadi. Agent hanya
        bekerja saat PC kamu menyala dan terhubung ke internet. Kami tidak menjamin hasil tertentu dari konten yang dibuat,
        misalnya jumlah penonton atau penjualan.
      </p>

      <h2>9. Batas tanggung jawab</h2>
      <p>
        Sejauh diizinkan hukum, tanggung jawab kami atas kerugian dari pemakaian Kantoraiku paling banyak sebesar harga
        yang kamu bayar untuk kantor tersebut. Kami tidak bertanggung jawab atas kerugian tidak langsung, termasuk
        kehilangan pendapatan, gangguan pada layanan pihak ketiga, atau akibat dari konten yang kamu terbitkan.
      </p>

      <h2>10. Menutup kantor</h2>
      <p>
        Kamu bisa meminta kantor ditutup kapan saja lewat email. Isi kantor yang ditutup dihapus permanen 30 hari
        kemudian.
      </p>

      <h2>11. Perubahan ketentuan</h2>
      <p>
        Kami bisa mengubah ketentuan ini. Perubahan penting kami umumkan lewat email atau dashboard paling lambat 14 hari
        sebelum berlaku. Bila kamu tetap memakai Kantoraiku setelah tanggal itu, kamu dianggap menyetujui perubahannya.
      </p>

      <h2>12. Hukum yang berlaku</h2>
      <p>
        Ketentuan ini tunduk pada hukum Republik Indonesia. Perselisihan diselesaikan lebih dulu secara musyawarah. Bila
        tidak tercapai kesepakatan, perselisihan diselesaikan di pengadilan negeri di wilayah tempat kedudukan kami.
      </p>
    </LegalPage>
  );
}

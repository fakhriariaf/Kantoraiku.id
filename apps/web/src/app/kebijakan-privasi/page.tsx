import type { Metadata } from "next";
import { LegalPage, legalEntity } from "@/components/legal/legal-page";
import { config } from "@/server/config";

export const metadata: Metadata = { title: "Kebijakan Privasi · Kantoraiku" };

export default function KebijakanPrivasiPage() {
  return (
    <LegalPage
      path="/kebijakan-privasi"
      title="Kebijakan Privasi"
      summary="Data apa yang kami simpan, untuk apa, siapa yang ikut memprosesnya, dan apa yang tetap berada di PC kamu."
    >
      <h2>1. Siapa kami</h2>
      <p>
        {legalEntity()} (&ldquo;kami&rdquo;) adalah pengendali data pribadi untuk layanan Kantoraiku, sesuai Undang-Undang
        Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
      </p>

      <h2>2. Data yang kami simpan</h2>
      <ul>
        <li>
          <strong>Saat membeli:</strong> nama, email, nomor WhatsApp, alamat kantor yang kamu pilih, cara bayar, dan status
          pembayaran.
        </li>
        <li>
          <strong>Akun:</strong> email dan password. Password disimpan sebagai hash oleh penyedia login kami, tidak dalam
          bentuk aslinya.
        </li>
        <li>
          <strong>Isi kantor:</strong> agent (nama, jabatan, uraian kerja, otak AI yang dipilih), tugas dan jadwalnya,
          channel, topik hasil riset beserta link sumbernya, naskah, catatan revisi, keputusan persetujuan, dan feed
          aktivitas.
        </li>
        <li>
          <strong>Perangkat:</strong> nama PC, versi konektor, waktu terakhir online, kunci publik konektor, dan keterangan
          apakah kunci AI sudah terpasang (ya atau tidak).
        </li>
        <li>
          <strong>Keamanan:</strong> alamat IP diubah menjadi kode acak (hash) untuk membatasi percobaan masuk dan pesanan
          berulang. Kode ini dihapus otomatis setelah satu hari.
        </li>
      </ul>

      <h2>3. Yang tidak kami simpan</h2>
      <ul>
        <li>API key dan login penyedia AI kamu. Keduanya ada di PC kamu dan dipakai langsung dari sana.</li>
        <li>Password dalam bentuk aslinya.</li>
        <li>Data dari cookie iklan atau pelacak analitik. Kami tidak memakai keduanya.</li>
      </ul>

      <h2>4. Untuk apa data dipakai</h2>
      <ul>
        <li>menjalankan kantor kamu dan mengirim tugas ke konektor di PC kamu;</li>
        <li>mengonfirmasi pembayaran dan menghubungi kamu soal pesanan;</li>
        <li>mengirim email masuk, reset password, dan pemberitahuan penting tentang layanan;</li>
        <li>menjaga keamanan layanan dan mencegah penyalahgunaan.</li>
      </ul>
      <p>Kami tidak menjual data kamu dan tidak memakainya untuk iklan.</p>

      <h2>5. Pihak yang ikut memproses data</h2>
      <ul>
        <li>
          <strong>Supabase:</strong> database dan login. Server di Singapura.
        </li>
        <li>
          <strong>Vercel:</strong> hosting dashboard.
        </li>
        <li>
          <strong>Resend:</strong> pengiriman email.
        </li>
        <li>
          <strong>Midtrans:</strong> pembayaran QRIS, virtual account, dan e-wallet, setelah metode itu tersedia.
        </li>
        <li>
          <strong>WhatsApp (Meta):</strong> bila kamu menghubungi kami atau mengirim bukti transfer lewat WhatsApp.
        </li>
      </ul>
      <p>
        Permintaan ke penyedia AI (misalnya OpenAI) dikirim dari PC kamu dengan akun kamu sendiri, bukan oleh kami. Isinya
        tunduk pada kebijakan privasi penyedia tersebut.
      </p>
      <p>
        Beberapa pemroses di atas berada di luar Indonesia, sehingga data kamu bisa disimpan atau diproses di luar negeri.
        Kami hanya memakai penyedia yang menerapkan perlindungan data yang memadai.
      </p>

      <h2>6. Cookie</h2>
      <p>
        Kami hanya memakai cookie sesi supaya kamu tetap masuk ke kantor. Cookie ini tidak bisa dibaca skrip di halaman dan
        tidak dipakai untuk melacak kamu di situs lain.
      </p>

      <h2>7. Berapa lama data disimpan</h2>
      <ul>
        <li>Isi kantor disimpan selama kantor aktif. Bila kantor ditutup, isinya dihapus permanen 30 hari kemudian.</li>
        <li>Catatan pesanan dan pembayaran disimpan selama yang diwajibkan aturan perpajakan dan akuntansi.</li>
        <li>Kode IP untuk pembatasan percobaan dihapus setelah satu hari.</li>
      </ul>

      <h2>8. Keamanan</h2>
      <p>
        Koneksi ke Kantoraiku dienkripsi (HTTPS). Data setiap kantor dipisahkan sehingga pengguna lain tidak bisa
        melihatnya. Konektor terhubung dengan token perangkat yang bisa kamu cabut kapan saja dari dashboard.
      </p>

      <h2>9. Hak kamu</h2>
      <ul>
        <li>meminta salinan data pribadi kamu;</li>
        <li>memperbaiki data yang salah;</li>
        <li>meminta data dihapus atau kantor ditutup;</li>
        <li>menarik persetujuan pemrosesan data, dengan akibat layanan tidak bisa dipakai lagi.</li>
      </ul>
      <p>
        Kirim permintaan ke <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> dari email yang terdaftar.
        Kami menanggapi paling lambat 3 x 24 jam.
      </p>

      <h2>10. Usia pengguna</h2>
      <p>Kantoraiku ditujukan untuk pengguna berusia 18 tahun ke atas.</p>

      <h2>11. Perubahan kebijakan</h2>
      <p>
        Bila fitur baru mengubah data yang kami proses (misalnya CS WhatsApp atau posting terjadwal), kebijakan ini kami
        perbarui dan kami umumkan lewat email atau dashboard sebelum fitur itu aktif.
      </p>
    </LegalPage>
  );
}

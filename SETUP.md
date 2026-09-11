# PB NEXA online — cara mengaktifkan

1. Buat project gratis di [Supabase](https://supabase.com/dashboard).
2. Buka **SQL Editor**, jalankan seluruh isi `supabase-schema.sql`.
3. Buka dialog **Connect** di dashboard Supabase, salin **Project URL** dan **Publishable key** ke `config.js`. Jangan pernah memakai Secret key.
4. Unggah folder ini ke hosting statis (misalnya Netlify Drop atau GitHub Pages). Jangan membuka sebagai file lokal, karena QR harus mengarah ke alamat situs yang dapat dibuka dari HP pemain.
5. Buka `index.html` sebagai admin, tekan **Sesi latihan baru**, lalu tampilkan QR yang muncul.

Catatan keamanan: rancangan awal ini memudahkan klub kecil memakai QR tanpa login. Sebelum dibuka ke publik, tambahkan login admin dan PIN sesi agar pemain hanya dapat mengubah absensinya sendiri.

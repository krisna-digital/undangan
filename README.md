# Repo Undangan

Halaman undangan statis untuk GitHub Pages. **Semua konten ada di `data.json`**; `index.html` tidak perlu diubah. Data diubah lewat repo editor (`editor/`) yang melakukan commit ke repo ini memakai GitHub REST API.

## Deploy

1. Buat repo baru di GitHub, misalnya `undangan` (public).
2. Unggah seluruh isi folder ini ke branch `main`.
3. Buka **Settings > Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Undangan tampil di `https://USERNAME.github.io/undangan/`.

Link untuk tamu: `https://USERNAME.github.io/undangan/?untuk=Nama+Tamu`

## Struktur

```
index.html          kerangka halaman (jangan diedit untuk konten)
data.json           seluruh isi undangan
assets/css/         gaya tampilan
assets/js/app.js    pembaca data.json dan perender halaman
assets/img/         gambar contoh (placeholder)
assets/uploads/     foto & lagu yang diunggah lewat editor (dibuat otomatis)
```

## Catatan

- Judul tab dan deskripsi diperbarui dari `data.json` lewat JavaScript. Pratinjau tautan di WhatsApp/Facebook tidak menjalankan JavaScript, jadi memakai teks `<meta>` statis di `index.html`. Ubah sekali secara manual bila ingin pratinjau tautan yang khusus.
- Browser memblokir lagu yang diputar otomatis; lagu mulai saat tamu menekan **Buka Undangan**.
- Perubahan di GitHub Pages butuh sekitar 1 menit untuk tampil.

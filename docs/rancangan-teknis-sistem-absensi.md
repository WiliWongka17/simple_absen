# RANCANGAN TEKNIS — Sistem Absensi Siswa Berbasis Web
### (Turunan eksekusi dari PRD, disiapkan untuk dikerjakan oleh AI coder secara bertahap)

---

## 0. CARA PAKAI DOKUMEN INI

Dokumen ini adalah **spesifikasi teknis siap-eksekusi**, bukan PRD ulang. Berikan dokumen ini ke AI coder **satu Tahap pada satu waktu** (lihat Bagian 9), jangan sekaligus. Setiap Tahap punya: file yang dibuat, tugas, dan acceptance criteria — AI coder wajib berhenti dan melapor setelah satu Tahap selesai, sebelum lanjut ke Tahap berikutnya (sesuai PRD poin 48).

Aturan keras yang tidak boleh dilanggar AI coder (diringkas dari PRD poin 44):
- Tidak boleh ganti stack (Next.js + TypeScript + Tailwind + Supabase/PostgreSQL + Vercel).
- Tidak boleh pakai Laravel, Express terpisah, MySQL, MongoDB, Firebase.
- Tidak boleh bikin app mobile native.
- Semua validasi kritikal (token, NIS, waktu, jarak, duplikasi) **wajib di server**, tidak boleh percaya data dari browser.
- `SUPABASE_SERVICE_ROLE_KEY` tidak boleh pernah dikirim ke client.

---

## 1. KEPUTUSAN DESAIN UNTUK MENGISI BAGIAN AMBIGU PRD

| # | Ambiguitas di PRD | Keputusan yang dipakai di rancangan ini |
|---|---|---|
| 1 | Role "Guru" disebut tapi tidak didefinisikan | MVP: Guru = admin dengan akses terbatas (lihat absensi & siswa, tanpa ubah pengaturan sekolah/radius/jam). Disimpan sebagai kolom `role` di tabel `admin_profiles` (`superadmin` / `guru`). Tidak menambah tabel baru. |
| 2 | Siapa yang boleh INSERT ke `attendance_records`? | Hanya lewat API Route (server, pakai service role). RLS tabel ini: deny semua untuk `anon`/`authenticated` biasa; admin hanya boleh `SELECT`. |
| 3 | Duplikasi dicek per tanggal atau per sesi? | Per **tanggal** (1 siswa = 1 record per hari), pakai `UNIQUE(student_id, attendance_date)`. Lebih sederhana & sesuai tujuan MVP. |
| 4 | Timezone tidak disebutkan | Semua timestamp pakai `timestamptz`. Zona waktu sekolah disimpan sebagai setting (`timezone`, default `Asia/Makassar` — bisa diganti sesuai lokasi sekolah). Perbandingan jam absensi dilakukan di server menggunakan zona waktu ini, bukan UTC mentah. |
| 5 | Hubungan accuracy vs radius | Dua validasi independen: (a) `accuracy <= max_accuracy_meters` → jika tidak, tolak dengan pesan "akurasi kurang baik"; (b) `distance <= radius_meters` (dihitung server, Haversine) → jika tidak, tolak "di luar area sekolah". |
| 6 | Versi framework tidak dipin | Next.js 15 (App Router), React 19, TypeScript 5, Node.js 20 LTS, Tailwind CSS 3. |
| 7 | Tidak ada anti brute-force NIS | Ditambahkan sebagai catatan P2 (opsional): rate-limit sederhana per-IP di API `/api/absen` (mis. max 10 request/menit). Tidak wajib untuk P0/P1. |
| 8 | Library QR | Pakai `qrcode` (generate QR di server/admin page) — ringan, tanpa dependency besar. Tidak perlu scanning library karena siswa scan pakai kamera bawaan HP (bukan built-in web scanner). |
| 9 | Token generator | Pakai `crypto.randomUUID()` (built-in Node/Web Crypto) — tidak perlu library tambahan. |

---

## 2. STACK & VERSI (PIN EKSAK)

```
Next.js        15.x (App Router)
React          19.x
TypeScript     5.x
Tailwind CSS   3.4.x
Node.js        20 LTS
Supabase JS    @supabase/supabase-js ^2.x
                @supabase/ssr ^0.x (untuk auth di server component/route handler)
qrcode         ^1.5.x (generate QR PNG/SVG dari token URL)
Hosting        Vercel
Database       PostgreSQL via Supabase Cloud
```

Tidak menambahkan Redux, tidak menambahkan backend terpisah, tidak menambahkan ORM besar (cukup `@supabase/supabase-js` query builder — tidak perlu Prisma untuk MVP sesuederhana ini, kecuali AI coder merasa migration lebih rapi pakai Supabase SQL editor/CLI migrations biasa).

---

## 3. SKEMA DATABASE (SQL LENGKAP)

```sql
-- ============ EXTENSIONS ============
create extension if not exists pgcrypto;

-- ============ TABLE: classes ============
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ TABLE: students ============
create table students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  name text not null,
  class_id uuid references classes(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_students_nis on students(nis);
create index idx_students_class_id on students(class_id);

-- ============ TABLE: school_settings (single-row config) ============
create table school_settings (
  id int primary key default 1,
  school_name text not null default 'Nama Sekolah',
  latitude double precision not null,
  longitude double precision not null,
  radius_meters int not null default 100,
  max_accuracy_meters int not null default 100,
  attendance_start_time time not null default '06:00',
  late_after_time time not null default '07:00',
  attendance_end_time time not null default '08:00',
  timezone text not null default 'Asia/Makassar',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

-- ============ TABLE: attendance_sessions ============
create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_sessions_token on attendance_sessions(token);

-- ============ TABLE: attendance_records ============
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  attendance_session_id uuid not null references attendance_sessions(id),
  attendance_date date not null,
  attendance_time timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  distance_from_school double precision,
  status text not null check (status in ('HADIR','TERLAMBAT','DITOLAK')),
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);
create index idx_attendance_student_date on attendance_records(student_id, attendance_date);
create index idx_attendance_date on attendance_records(attendance_date);

-- ============ TABLE: admin_profiles ============
-- Autentikasi pakai Supabase Auth (auth.users). Tabel ini hanya menyimpan role tambahan.
create table admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'guru' check (role in ('superadmin','guru')),
  created_at timestamptz not null default now()
);
```

### 3.1 Row Level Security (RLS)

```sql
alter table students enable row level security;
alter table classes enable row level security;
alter table attendance_records enable row level security;
alter table attendance_sessions enable row level security;
alter table school_settings enable row level security;
alter table admin_profiles enable row level security;

-- students & classes: hanya admin ter-autentikasi yang boleh baca/tulis
create policy "admin_read_students" on students for select
  using (auth.role() = 'authenticated');
create policy "admin_write_students" on students for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin_read_classes" on classes for select
  using (auth.role() = 'authenticated');
create policy "admin_write_classes" on classes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- attendance_records: admin hanya boleh SELECT. Tidak ada policy INSERT/UPDATE untuk
-- anon/authenticated -> insert HANYA lewat API route pakai service role (bypass RLS).
create policy "admin_read_attendance" on attendance_records for select
  using (auth.role() = 'authenticated');

-- attendance_sessions: admin boleh kelola penuh. Publik (anon) TIDAK boleh baca token
-- langsung dari tabel -> validasi token dilakukan lewat API route (service role),
-- bukan query langsung dari client.
create policy "admin_manage_sessions" on attendance_sessions for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- school_settings: admin boleh baca; hanya superadmin boleh update (dicek di API layer,
-- RLS cukup batasi ke authenticated).
create policy "admin_read_settings" on school_settings for select
  using (auth.role() = 'authenticated');
create policy "admin_write_settings" on school_settings for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- admin_profiles: user hanya boleh baca profilnya sendiri
create policy "self_read_profile" on admin_profiles for select
  using (auth.uid() = id);
```

---

## 4. STRUKTUR FOLDER PROYEK

```
/app
  /absen
    page.tsx                 -> halaman absensi siswa (client component)
  /admin
    /login/page.tsx
    /page.tsx                 -> dashboard
    /siswa/page.tsx
    /kelas/page.tsx
    /absensi/page.tsx
    /pengaturan/page.tsx
    /qr/page.tsx
    layout.tsx                -> cek session admin, sidebar nav
  /api
    /absen/route.ts            -> POST: proses absensi siswa
    /admin/students/route.ts   -> GET/POST
    /admin/students/[id]/route.ts -> PATCH
    /admin/classes/route.ts
    /admin/classes/[id]/route.ts
    /admin/settings/route.ts
    /admin/sessions/route.ts   -> GET/POST (buat & aktifkan QR session)
    /admin/export/route.ts     -> GET (CSV)
  page.tsx                     -> redirect ke /absen atau landing simpel
/lib
  supabase/server.ts           -> client Supabase server-side (service role, dipakai di route.ts)
  supabase/client.ts           -> client Supabase browser (anon key, dipakai admin auth login)
  geo.ts                       -> fungsi haversine()
  time.ts                      -> fungsi validasi jam absensi (timezone-aware)
  validation.ts                -> skema validasi input (zod, ringan)
/components
  admin/*                      -> komponen tabel, form, sidebar (dibuat seperlunya, jangan over-abstract)
/types
  index.ts                     -> tipe TS untuk Student, Class, AttendanceRecord, dll
.env.local
```

---

## 5. ENVIRONMENT VARIABLES

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # HANYA dipakai di /app/api/**/route.ts, tidak pernah di client component
```

---

## 6. KONTRAK API

### 6.1 `POST /api/absen`
Body:
```json
{ "token": "string", "nis": "string", "latitude": 0.0, "longitude": 0.0, "accuracy": 0.0 }
```
Urutan validasi server (semua wajib, hentikan di kegagalan pertama, kembalikan pesan sesuai PRD bagian 8/21):
1. `token` ditemukan di `attendance_sessions` dan `is_active = true` dan `now() between start_time and end_time` → jika tidak: `"QR Code sudah tidak berlaku..."`
2. `nis` ditemukan di `students` → jika tidak: `"NIS tidak ditemukan..."`
3. `students.is_active = true` → jika tidak: `"Siswa tidak aktif."` (pesan bisa disamakan ke "akun tidak aktif, hubungi admin")
4. `accuracy <= school_settings.max_accuracy_meters` → jika tidak: `"Akurasi lokasi Anda kurang baik..."`
5. Hitung `distance` via Haversine(lat/lng siswa, lat/lng sekolah) → `distance <= radius_meters` → jika tidak: `"Anda berada di luar area sekolah."`
6. Cek waktu sekarang (timezone sekolah) terhadap `attendance_start_time`–`attendance_end_time` → jika di luar rentang: `"Absensi belum dibuka."` / `"Absensi sudah ditutup."`
7. Tentukan status: `now <= late_after_time` → `HADIR`; else jika masih `<= attendance_end_time` → `TERLAMBAT`
8. Cek belum ada record untuk `(student_id, attendance_date=today)` → jika sudah ada: `"Anda sudah melakukan absensi hari ini."`
9. Insert record (pakai service role client) → return sukses dengan `{ name, nis, class_name, time, status }`

Response sukses: `200 { success: true, data: {...} }`
Response gagal: `400 { success: false, message: "..." }` (pesan human-readable, tidak bocorkan detail DB — sesuai PRD bagian 41).

### 6.2 Admin endpoints
- `GET/POST /api/admin/students`, `PATCH /api/admin/students/[id]` — semua wajib cek session admin (middleware/`auth.getUser()`) sebelum proses, gunakan Supabase client dengan anon key + cookie session (bukan service role) supaya RLS tetap berlaku sebagai lapisan kedua.
- `GET/POST /api/admin/classes`, `/api/admin/classes/[id]`
- `GET/PATCH /api/admin/settings` (superadmin only, dicek di kode: `admin_profiles.role === 'superadmin'`)
- `POST /api/admin/sessions` — generate `token = crypto.randomUUID()`, simpan start/end time
- `GET /api/admin/export?from=&to=&class_id=` — return CSV stream sesuai kolom PRD bagian 26

---

## 7. ALGORITMA INTI

### 7.1 Haversine (di `/lib/geo.ts`)
```ts
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meter
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### 7.2 Validasi waktu (timezone-aware, di `/lib/time.ts`)
Gunakan `Intl.DateTimeFormat` dengan `timeZone: school_settings.timezone` untuk mendapatkan jam lokal sekolah dari `new Date()` server, lalu bandingkan sebagai string `HH:mm` terhadap `attendance_start_time` / `late_after_time` / `attendance_end_time`. Jangan pernah pakai waktu dari body request.

---

## 8. SPESIFIKASI HALAMAN (ringkas, detail teks ada di PRD bagian 20–22)

- `/absen`: form NIS + tombol ABSEN, state loading "Memeriksa lokasi...", hasil sukses/gagal ditampilkan di halaman yang sama (tanpa reload). Mobile-first, tanpa animasi berat.
- `/admin/login`: email+password via Supabase Auth.
- `/admin`: kartu ringkasan (total siswa, hadir, terlambat, belum absen, %), filter tanggal+kelas.
- `/admin/siswa`, `/admin/kelas`: CRUD sederhana (tabel + form modal/halaman terpisah, pilih yang paling simpel).
- `/admin/absensi`: tabel + filter + tombol export CSV.
- `/admin/pengaturan`: form school_settings.
- `/admin/qr`: tombol "Buat Sesi Baru", tampilkan QR (pakai lib `qrcode`) dari URL `https://domain/absen?token=...`, status aktif/nonaktif.

---

## 9. RENCANA IMPLEMENTASI BERTAHAP (berikan ke AI coder SATU TAHAP PER PROMPT)

Setiap Tahap: AI coder wajib (a) sebutkan file yang dibuat/diubah, (b) beri kode lengkap, (c) beri instruksi run/test, (d) tunggu konfirmasi "lanjut" sebelum Tahap berikutnya.

| Tahap | Tugas | Acceptance Criteria |
|---|---|---|
| 1 | Init project Next.js 15 + TS + Tailwind, jalan di localhost | `npm run dev` tampil halaman default tanpa error |
| 2 | Install & konfigurasi `@supabase/supabase-js`, `@supabase/ssr`, buat `/lib/supabase/server.ts` & `client.ts`, isi `.env.local` | Bisa konek ke Supabase project (test query sederhana) |
| 3 | Jalankan seluruh SQL Bagian 3 & 3.1 di Supabase (migration/SQL editor) | Semua tabel + RLS ada, dicek via Supabase dashboard |
| 4 | Buat CRUD siswa & kelas (`/admin/siswa`, `/admin/kelas`, API terkait) — **belum perlu auth dulu** | Bisa tambah/lihat/ubah siswa & kelas dari UI |
| 5 | Buat login admin (`/admin/login`, Supabase Auth) + proteksi route `/admin/*` via middleware/layout | Tanpa login, `/admin` redirect ke `/admin/login`; setelah login bisa masuk |
| 6 | Buat halaman `/absen` (UI saja dulu, tanpa logic validasi) | Form NIS tampil, mobile-friendly |
| 7 | Implementasi validasi NIS di `POST /api/absen` (cek exists + is_active) | TEST 2, TEST 7 (Bagian 10) lulus |
| 8 | Implementasi QR token: tabel session sudah ada, buat `/admin/qr` untuk generate session + tampilkan QR | Admin bisa buat sesi, dapat QR image, token tersimpan |
| 9 | Implementasi validasi token di `/api/absen` (exists, aktif, dalam rentang waktu sesi) | TEST 5 lulus |
| 10 | Implementasi GPS di client `/absen` (`navigator.geolocation.getCurrentPosition`), kirim lat/lng/accuracy ke API | Browser minta izin lokasi saat tombol ABSEN ditekan (bukan saat halaman dibuka) |
| 11 | Implementasi perhitungan radius (Haversine) + validasi accuracy di server | TEST 3, TEST 4 lulus |
| 12 | Implementasi validasi jam absensi (timezone-aware) + penentuan status HADIR/TERLAMBAT | TEST 8, TEST 9 lulus |
| 13 | Implementasi penyimpanan record + duplicate prevention (unique constraint + cek sebelum insert) | TEST 1, TEST 6 lulus |
| 14 | Buat dashboard admin sederhana (ringkasan angka) | Data ringkasan sesuai isi tabel |
| 15 | Buat filter absensi + export CSV (`/admin/absensi`, `/api/admin/export`) | TEST 12 lulus |
| 16 | Buat `/admin/pengaturan` (school_settings CRUD) | Admin bisa ubah koordinat/radius/jam, langsung mempengaruhi validasi |
| 17 | Testing menyeluruh (Bagian 10), security review RLS & service role | Semua 12 test case lulus, service role key tidak ada di bundle client (`grep` di build output) |
| 18 | Deploy ke Vercel, set env vars, cek HTTPS, tes dari HP asli di lokasi nyata | Absen berhasil dari HP di lokasi sekolah, ditolak di luar radius |

---

## 10. TEST PLAN (mengacu PRD bagian 42, ditegaskan sebagai acceptance test)

| # | Skenario | Input kunci | Hasil diharapkan |
|---|---|---|---|
| 1 | Semua valid | NIS aktif, token aktif, dalam radius & jam | `HADIR`/`TERLAMBAT` tersimpan |
| 2 | NIS invalid | NIS tidak ada di DB | 400 "NIS tidak ditemukan" |
| 3 | Di luar radius | distance > radius_meters | 400 "di luar area sekolah" |
| 4 | Accuracy buruk | accuracy > max_accuracy_meters | 400 "akurasi kurang baik" |
| 5 | Token expired/nonaktif | token tidak ditemukan / is_active=false / di luar start-end | 400 "QR Code sudah tidak berlaku" |
| 6 | Sudah absen | record (student_id, today) sudah ada | 400 "sudah melakukan absensi hari ini" |
| 7 | Siswa nonaktif | students.is_active=false | 400 "siswa tidak aktif" |
| 8 | Di luar jam absensi | now < start atau now > end | 400 "belum dibuka" / "sudah ditutup" |
| 9 | Dalam jam absensi | now antara start–end | lolos validasi waktu |
| 10 | Admin login | kredensial benar | masuk ke `/admin` |
| 11 | Admin logout | klik logout | redirect ke `/admin/login`, session hilang |
| 12 | Export CSV | klik export dengan filter | file CSV terunduh, kolom sesuai Bagian 26 PRD |

---

## 11. DEFINITION OF DONE

Gunakan checklist PRD bagian 45 apa adanya — semua 27 item di sana tetap berlaku sebagai kriteria selesai MVP, tidak diubah di rancangan ini.

---

## 12. PANDUAN MEMBERI PROMPT KE AI CODER MURAH

Saran urutan prompt (copy-paste per Tahap):

```
Kamu akan mengerjakan proyek "Sistem Absensi Siswa" berdasarkan dokumen rancangan
teknis berikut [tempel Bagian 0–8 dokumen ini sebagai konteks tetap].

Kerjakan HANYA Tahap <N> dari tabel Bagian 9. Jangan mengerjakan tahap lain.
Setelah selesai: sebutkan file yang dibuat/diubah, tampilkan kode lengkap,
beri instruksi cara menjalankan/testing, lalu berhenti dan tunggu konfirmasi saya.
```

Ulangi untuk Tahap 1 → 18 secara berurutan. Jika AI coder menemukan error di tengah jalan, minta dia: *"jelaskan penyebab, beri solusi, jangan ubah arsitektur"* (sesuai PRD poin 48).

---

*Dokumen ini adalah turunan teknis dari PRD asli. Jika ada perubahan scope, ubah PRD asli terlebih dahulu, baru sinkronkan dokumen ini.*

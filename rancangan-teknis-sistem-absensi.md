# RANCANGAN TEKNIS — Sistem Absensi Siswa Berbasis Web
### (Turunan eksekusi dari PRD, disiapkan untuk dikerjakan oleh AI coder secara bertahap)

> **UPDATE v1.1** — menambahkan: (1) import data siswa via Excel + download template, (2) fitur anti-titip-absen berbasis pengikatan device, (3) perbaikan kontras teks pada input field. Lihat Bagian 1 (baris tambahan), 3.2, 4, 6.3, 8, 9 (Tahap 19–21), dan 10 untuk detailnya.

> **UPDATE v1.2** — menambahkan: (1) admin bisa mengedit status kehadiran siswa secara manual (3 status: Hadir / Belum Absen / Tidak Hadir, default Belum Absen), (2) download rekap absensi bisa pilih rentang tanggal (dari–sampai), (3) hasil download berubah dari CSV ke file **Excel rekap** (siswa x tanggal). Lihat Bagian 1 (baris 13–15), 3.3, 6.1 (langkah 11), 6.5, 6.6, 8, 9 (Tahap 22–23), dan 10 (TEST 17–19).

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
| 10 | Format import siswa | Excel `.xlsx` (bukan CSV) karena guru/admin sekolah lebih familiar dengan Excel. Kolom wajib: `NIS`, `Nama`, `Kelas`, `Status Aktif`. Nama kelas di file harus cocok persis (case-insensitive, trim spasi) dengan `classes.name` yang sudah ada — jika tidak cocok, baris ditandai gagal (tidak otomatis membuat kelas baru, supaya tidak muncul kelas duplikat karena typo). |
| 11 | Mekanisme "titip absen" mana yang dicegah | PRD sudah mencegah 1 siswa absen 2x (duplicate check) dan siswa di luar lokasi (GPS). Yang **belum** dicegah: satu HP dipakai bergantian untuk absenkan banyak NIS teman yang tidak hadir secara fisik. Solusi: **pengikatan device per hari/sesi** — 1 device hanya boleh dipakai untuk 1 NIS per sesi absensi (default; configurable). Lihat Bagian 3.2/6.3. |
| 12 | Cara identifikasi device | `device_id` (UUID) dibuat sekali di browser dengan `crypto.randomUUID()`, disimpan di `localStorage`, dan disertakan di setiap request `/api/absen`. Ini **bukan fingerprint anti-spoof sempurna** (bisa dihindari dengan clear localStorage/mode incognito) — didokumentasikan sebagai keterbatasan yang sama seperti GPS (PRD bagian 38–39), berfungsi sebagai lapisan pencegahan tambahan, bukan jaminan mutlak. |
| 13 | Relasi status scan lama (HADIR/TERLAMBAT/DITOLAK) vs status harian baru (Hadir/Belum Absen/Tidak Hadir) | Log scan mentah di `attendance_records` **tidak diubah/dihapus** — tetap menyimpan `HADIR`/`TERLAMBAT`/`DITOLAK` sebagai bukti waktu absen sesungguhnya. Ditambahkan tabel baru `student_daily_status` sebagai "status harian" yang ditampilkan & bisa diedit admin, dengan 3 nilai: `HADIR`, `BELUM_ABSEN`, `TIDAK_HADIR`. Saat siswa berhasil scan (baik tepat waktu maupun `TERLAMBAT`), status harian otomatis diisi `HADIR` (keduanya digabung karena siswa tetap datang secara fisik); detail jam & keterlambatan tetap bisa dilihat lewat log `attendance_records` untuk audit. |
| 14 | Siapa yang boleh override status harian, dan apakah scan berikutnya menimpa status manual | Hanya admin (`admin_profiles`, role apa pun) yang boleh mengubah status harian manual. Jika siswa yang statusnya sudah di-set manual (`TIDAK_HADIR` dsb.) kemudian benar-benar scan dan lolos semua validasi, status harian **ditimpa otomatis menjadi `HADIR`** (`source='SCAN'`) — scan asli dianggap ground truth yang lebih valid daripada input manual sebelumnya. |
| 15 | Format & cakupan file download absensi | Diubah dari CSV (daftar mentah per baris) menjadi **file Excel rekap**: baris = siswa, kolom = tiap tanggal dalam rentang yang dipilih admin, isi sel = status harian (`Hadir`/`Tidak Hadir`/`Belum Absen`), plus kolom ringkasan total per siswa. Filter tanggal berubah dari 1 tanggal menjadi rentang (dari–sampai). |

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

### 3.2 Migration tambahan — Device Binding (anti-titip-absen)

```sql
-- Tambah kolom device_id pada attendance_records
alter table attendance_records
  add column device_id text not null default 'unknown';

create index idx_attendance_device_date on attendance_records(device_id, attendance_date);

-- Setting untuk mengaktifkan/menonaktifkan & konfigurasi fitur ini
alter table school_settings
  add column enable_device_binding boolean not null default true,
  add column max_students_per_device_per_day int not null default 1;
```

Catatan: `device_id = 'unknown'` sebagai default hanya untuk kompatibilitas data lama sebelum fitur ini ada; untuk request baru, `device_id` wajib dikirim dari client (validasi di Bagian 6.3).

### 3.3 Migration tambahan — Status Harian Siswa (edit manual oleh admin)

```sql
create table student_daily_status (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  status_date date not null,
  status text not null default 'BELUM_ABSEN'
    check (status in ('HADIR','BELUM_ABSEN','TIDAK_HADIR')),
  source text not null default 'MANUAL' check (source in ('SCAN','MANUAL')),
  updated_by uuid references admin_profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, status_date)
);
create index idx_daily_status_date on student_daily_status(status_date);
create index idx_daily_status_student on student_daily_status(student_id);

alter table student_daily_status enable row level security;
create policy "admin_manage_daily_status" on student_daily_status for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

Catatan penting: **tidak ada row otomatis dibuat untuk setiap siswa setiap hari.** Selama belum ada row untuk `(student_id, status_date)` tertentu, status yang ditampilkan di UI dianggap `BELUM_ABSEN` (dihitung, bukan disimpan) — ini sesuai instruksi "secara default status siswa Belum Absen" tanpa perlu job/cron harian. Row baru dibuat saat: (a) siswa berhasil scan (`source='SCAN'`), atau (b) admin mengedit status secara manual (`source='MANUAL'`).

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
    /siswa/import/page.tsx     -> halaman upload Excel + tombol download template
    /kelas/page.tsx
    /absensi/page.tsx
    /pengaturan/page.tsx
    /qr/page.tsx
    layout.tsx                -> cek session admin, sidebar nav
  /api
    /absen/route.ts            -> POST: proses absensi siswa
    /admin/students/route.ts   -> GET/POST
    /admin/students/[id]/route.ts -> PATCH
    /admin/students/template/route.ts -> GET: download file .xlsx kosong (template)
    /admin/students/import/route.ts   -> POST: upload & proses file .xlsx
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
  device.ts                    -> fungsi getOrCreateDeviceId() (client-side, localStorage)
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
{ "token": "string", "nis": "string", "latitude": 0.0, "longitude": 0.0, "accuracy": 0.0, "device_id": "string" }
```
`device_id` wajib dikirim (lihat `/lib/device.ts`, Bagian 6.3.1) — jika kosong/tidak ada, tolak dengan `400 "Perangkat tidak dikenali, silakan muat ulang halaman."` sebelum lanjut ke validasi lain.

Urutan validasi server (semua wajib, hentikan di kegagalan pertama, kembalikan pesan sesuai PRD bagian 8/21):
1. `token` ditemukan di `attendance_sessions` dan `is_active = true` dan `now() between start_time and end_time` → jika tidak: `"QR Code sudah tidak berlaku..."`
2. `nis` ditemukan di `students` → jika tidak: `"NIS tidak ditemukan..."`
3. `students.is_active = true` → jika tidak: `"Siswa tidak aktif."` (pesan bisa disamakan ke "akun tidak aktif, hubungi admin")
4. `accuracy <= school_settings.max_accuracy_meters` → jika tidak: `"Akurasi lokasi Anda kurang baik..."`
5. Hitung `distance` via Haversine(lat/lng siswa, lat/lng sekolah) → `distance <= radius_meters` → jika tidak: `"Anda berada di luar area sekolah."`
6. Cek waktu sekarang (timezone sekolah) terhadap `attendance_start_time`–`attendance_end_time` → jika di luar rentang: `"Absensi belum dibuka."` / `"Absensi sudah ditutup."`
7. **[BARU] Anti-titip-absen device binding** — hanya jika `school_settings.enable_device_binding = true`: hitung jumlah *siswa berbeda* yang sudah absen hari ini (`attendance_date = today`) dengan `device_id` yang sama. Jika jumlah tersebut sudah `>= max_students_per_device_per_day` **dan** siswa yang mencoba absen sekarang bukan salah satu dari mereka → tolak: `"Perangkat ini sudah digunakan untuk absensi siswa lain hari ini. Setiap siswa harus absen menggunakan perangkat sendiri."`
8. Tentukan status: `now <= late_after_time` → `HADIR`; else jika masih `<= attendance_end_time` → `TERLAMBAT`
9. Cek belum ada record untuk `(student_id, attendance_date=today)` → jika sudah ada: `"Anda sudah melakukan absensi hari ini."`
10. Insert record (termasuk `device_id`, pakai service role client) → return sukses dengan `{ name, nis, class_name, time, status }`
11. **[BARU]** Upsert ke `student_daily_status`: `(student_id, status_date=today)` → `status='HADIR'`, `source='SCAN'`, `updated_by=null` (karena bukan admin) — menimpa status manual sebelumnya jika ada (lihat Bagian 1 baris 14).

Response sukses: `200 { success: true, data: {...} }`
Response gagal: `400 { success: false, message: "..." }` (pesan human-readable, tidak bocorkan detail DB — sesuai PRD bagian 41).

### 6.2 Admin endpoints
- `GET/POST /api/admin/students`, `PATCH /api/admin/students/[id]` — semua wajib cek session admin (middleware/`auth.getUser()`) sebelum proses, gunakan Supabase client dengan anon key + cookie session (bukan service role) supaya RLS tetap berlaku sebagai lapisan kedua.
- `GET/POST /api/admin/classes`, `/api/admin/classes/[id]`
- `GET/PATCH /api/admin/settings` (superadmin only, dicek di kode: `admin_profiles.role === 'superadmin'`)
- `POST /api/admin/sessions` — generate `token = crypto.randomUUID()`, simpan start/end time
- `GET /api/admin/export?from=&to=&class_id=` — **[DIUBAH v1.2]** lihat Bagian 6.6 (sebelumnya CSV 1 hari, sekarang Excel rekap rentang tanggal)

### 6.3.1 `/lib/device.ts` (client-side, dipakai halaman `/absen`)
```ts
export function getOrCreateDeviceId(): string {
  const KEY = "absensi_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
```
Dipanggil sekali saat halaman `/absen` dimuat, hasilnya disertakan sebagai field `device_id` saat submit ke `/api/absen`. Tidak perlu ditampilkan ke siswa.

### 6.4 Import Data Siswa via Excel

**`GET /api/admin/students/template`**
Mengembalikan file `.xlsx` (generate on-the-fly pakai lib `xlsx`/SheetJS di server) berisi:
- Header row: `NIS | Nama | Kelas | Status Aktif`
- 1–2 baris contoh (mis. `12345 | Budi Santoso | X IPA 1 | AKTIF`) supaya format jelas
- Sheet kedua (opsional) berisi daftar nama kelas yang sudah ada di `classes`, sebagai referensi copy-paste supaya admin tidak salah ketik nama kelas.

**`POST /api/admin/students/import`** (multipart/form-data, field `file`)
Alur proses server:
1. Parse file `.xlsx` dengan lib `xlsx` (`XLSX.read(buffer)`).
2. Untuk tiap baris: validasi `NIS` (wajib, unik dalam file), `Nama` (wajib), `Kelas` (harus cocok nama di tabel `classes`, case-insensitive/trim), `Status Aktif` (`AKTIF`/`TIDAK AKTIF`, default `AKTIF` jika kosong).
3. Cek NIS terhadap data siswa yang sudah ada di DB:
   - Jika NIS sudah ada → **skip** baris tsb dan catat sebagai "sudah ada, dilewati" (tidak menimpa data existing secara otomatis, supaya aman).
   - Jika kelas tidak ditemukan → baris gagal dengan alasan "kelas tidak ditemukan: <nama>".
4. Insert massal baris yang valid dalam satu transaksi/batch.
5. Return ringkasan:
```json
{
  "success": true,
  "summary": { "total_rows": 50, "berhasil": 45, "dilewati_duplikat": 3, "gagal": 2 },
  "errors": [ { "row": 12, "reason": "kelas tidak ditemukan: X IPS 3" } ]
}
```
UI `/admin/siswa/import` menampilkan ringkasan ini setelah upload (termasuk daftar baris gagal beserta alasannya), plus tombol "Download Template" yang memanggil endpoint template di atas.

### 6.5 [BARU] Edit Status Kehadiran Siswa (manual oleh admin)

**`PATCH /api/admin/attendance/status`**
Body:
```json
{ "student_id": "uuid", "status_date": "2026-08-28", "status": "HADIR | BELUM_ABSEN | TIDAK_HADIR" }
```
Alur:
1. Cek session admin aktif (semua role boleh, tidak dibatasi superadmin — mengedit status kehadiran adalah tugas harian guru).
2. Validasi `status` termasuk salah satu dari 3 nilai enum.
3. Upsert ke `student_daily_status`: jika row untuk `(student_id, status_date)` sudah ada → update `status`, `source='MANUAL'`, `updated_by=<id admin login>`, `updated_at=now()`; jika belum ada → insert baru.
4. Return `{ success: true }`.

Catatan: endpoint ini **tidak mengubah/menghapus** apa pun di `attendance_records` (log scan asli tetap utuh sebagai audit trail) — hanya mengubah `student_daily_status`.

**`GET /api/admin/attendance/status?date=&class_id=`**
Return daftar semua siswa aktif (difilter kelas jika ada) untuk 1 tanggal, masing-masing dengan status harian terkini (hasil `COALESCE` dari `student_daily_status`, default `BELUM_ABSEN` jika belum ada row) dan jam scan asli jika ada (dari `attendance_records`, untuk ditampilkan sebagai info tambahan, bukan untuk diedit). Dipakai untuk mengisi tabel di halaman `/admin/absensi`.

### 6.6 [DIUBAH v1.2] Export Rekap Absensi (Excel, rentang tanggal)

**`GET /api/admin/export?from=YYYY-MM-DD&to=YYYY-MM-DD&class_id=`** (parameter `class_id` opsional)

Perubahan dari desain awal: dulu CSV daftar mentah per baris untuk 1 tanggal → sekarang **file Excel (`.xlsx`) berbentuk rekap matriks** untuk rentang tanggal, memakai lib `xlsx` (sudah dipakai untuk fitur import).

Struktur sheet:
- Kolom tetap: `No | NIS | Nama | Kelas`
- Satu kolom per tanggal dalam rentang `from`–`to` (format header `DD/MM`), isi sel = label status harian siswa pada tanggal tsb: `Hadir` / `Tidak Hadir` / `Belum Absen` (hasil `COALESCE` dari `student_daily_status`, sama seperti Bagian 6.5).
- Kolom ringkasan di akhir: `Total Hadir | Total Tidak Hadir | Total Belum Absen | % Kehadiran` (dihitung dari jumlah kolom tanggal di sheet tsb).
- Baris diurutkan per kelas lalu nama.

Alur server:
1. Validasi `from <= to`, dan batasi rentang maksimum wajar (mis. 3 bulan) supaya tidak membuat kolom terlalu banyak — jika lebih, tolak dengan pesan "Rentang tanggal maksimal 3 bulan."
2. Ambil daftar siswa aktif (filter `class_id` jika ada).
3. Ambil semua row `student_daily_status` dalam rentang tanggal untuk siswa-siswa tsb.
4. Bangun matriks di memory, generate workbook dengan `xlsx`, kembalikan sebagai file dengan header `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` dan `Content-Disposition: attachment; filename="rekap-absensi-<from>-sd-<to>.xlsx"`.

UI `/admin/absensi` (lihat Bagian 8) menyediakan dua input tanggal (dari–sampai) yang dipakai baik untuk menampilkan tabel di layar maupun untuk parameter tombol download ini.

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
- `/admin/siswa/import`: **[BARU]** tombol "Download Template Excel" (memanggil `GET /api/admin/students/template`) + input upload file `.xlsx` + tombol "Import" (memanggil `POST /api/admin/students/import`) + area hasil ringkasan (berhasil/dilewati/gagal beserta alasan per baris, lihat Bagian 6.4).
- `/admin/absensi`: **[DIUBAH v1.2]** filter berubah dari 1 tanggal menjadi **rentang tanggal** (input "Dari tanggal" & "Sampai tanggal") + filter kelas. Tabel yang tampil di layar tetap menampilkan 1 tanggal pada satu waktu (pilih salah satu tanggal dalam rentang, atau default = tanggal `to`) berisi kolom Nama, NIS, Kelas, **Status (dropdown editable: Hadir / Belum Absen / Tidak Hadir)**, Jam Absen (readonly, dari log scan jika ada). Mengubah dropdown langsung memanggil `PATCH /api/admin/attendance/status` dan menyimpan otomatis (tanpa tombol simpan terpisah, cukup optimistic update + toast konfirmasi). Tombol "Download Rekap Excel" memakai rentang tanggal yang sama untuk memanggil `GET /api/admin/export` (Bagian 6.6).
- `/admin/pengaturan`: form school_settings, **tambahkan** toggle "Aktifkan proteksi anti-titip-absen (device binding)" dan input angka "Maks. siswa per perangkat per hari" (default 1).
- `/admin/qr`: tombol "Buat Sesi Baru", tampilkan QR (pakai lib `qrcode`) dari URL `https://domain/absen?token=...`, status aktif/nonaktif.

### 8.1 [PERBAIKAN] Kontras teks pada input field

Bug yang dilaporkan: teks di dalam field (mis. input NIS di `/absen`) nyaris tidak terlihat — kemungkinan besar besar penyebabnya salah satu dari:
1. Class Tailwind default browser reset membuat warna teks input mewarisi warna placeholder yang terlalu terang, atau
2. Dipakai utility opacity (`opacity-50`, `text-opacity-*`) di elemen pembungkus yang ikut menurunkan opasitas teks di dalamnya, atau
3. Warna teks tidak di-set eksplisit sehingga jatuh ke default abu-abu terang bawaan browser/dark-mode.

**Aturan wajib untuk semua input/textarea di seluruh aplikasi** (baik `/absen` maupun form admin):
```tsx
<input
  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3
             text-base text-gray-900 placeholder:text-gray-400
             focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
  ...
/>
```
Ketentuan:
- Teks yang diketik user: **wajib** `text-gray-900` (bukan `text-gray-400`/`text-gray-500`, dan jangan mewarisi warna dari parent).
- Placeholder boleh lebih pudar: `placeholder:text-gray-400` — tapi ini beda dari teks yang sudah diketik.
- **Jangan** pasang `opacity-*` atau `text-opacity-*` di `<input>` atau elemen pembungkusnya kecuali memang untuk state `disabled`.
- Kontras minimal harus memenuhi WCAG AA (rasio ≥ 4.5:1) — kombinasi `text-gray-900` di atas `bg-white` sudah aman.
- Terapkan aturan yang sama di semua form admin (siswa, kelas, pengaturan, login) supaya konsisten.

---

## 9. RENCANA IMPLEMENTASI BERTAHAP (berikan ke AI coder SATU TAHAP PER PROMPT)

Setiap Tahap: AI coder wajib (a) sebutkan file yang dibuat/diubah, (b) beri kode lengkap, (c) beri instruksi run/test, (d) tunggu konfirmasi "lanjut" sebelum Tahap berikutnya.

> **Cara pakai kolom Status**: setelah AI coder menyelesaikan satu Tahap dan kamu sudah cek acceptance criteria-nya terpenuhi, ubah `⬜ Belum` menjadi `✅ Selesai` di baris tersebut. Setiap mulai sesi baru dengan AI coder, tempelkan tabel ini (yang sudah diupdate statusnya) supaya dia langsung tahu harus mulai dari tahap mana, tanpa mengulang yang sudah jadi.

| Tahap | Tugas | Acceptance Criteria | Status |
|---|---|---|---|
| 1 | Init project Next.js 15 + TS + Tailwind, jalan di localhost | `npm run dev` tampil halaman default tanpa error | ✅ Selesai |
| 2 | Install & konfigurasi `@supabase/supabase-js`, `@supabase/ssr`, buat `/lib/supabase/server.ts` & `client.ts`, isi `.env.local` | Bisa konek ke Supabase project (test query sederhana) | ✅ Selesai |
| 3 | Jalankan seluruh SQL Bagian 3 & 3.1 di Supabase (migration/SQL editor) | Semua tabel + RLS ada, dicek via Supabase dashboard | ✅ Selesai |
| 4 | Buat CRUD siswa & kelas (`/admin/siswa`, `/admin/kelas`, API terkait) — **belum perlu auth dulu** | Bisa tambah/lihat/ubah siswa & kelas dari UI | ✅ Selesai |
| 5 | Buat login admin (`/admin/login`, Supabase Auth) + proteksi route `/admin/*` via middleware/layout | Tanpa login, `/admin` redirect ke `/admin/login`; setelah login bisa masuk | ✅ Selesai |
| 6 | Buat halaman `/absen` (UI saja dulu, tanpa logic validasi) | Form NIS tampil, mobile-friendly | ✅ Selesai |
| 7 | Implementasi validasi NIS di `POST /api/absen` (cek exists + is_active) | TEST 2, TEST 7 (Bagian 10) lulus | ✅ Selesai |
| 8 | Implementasi QR token: tabel session sudah ada, buat `/admin/qr` untuk generate session + tampilkan QR | Admin bisa buat sesi, dapat QR image, token tersimpan | ✅ Selesai |
| 9 | Implementasi validasi token di `/api/absen` (exists, aktif, dalam rentang waktu sesi) | TEST 5 lulus | ✅ Selesai |
| 10 | Implementasi GPS di client `/absen` (`navigator.geolocation.getCurrentPosition`), kirim lat/lng/accuracy ke API | Browser minta izin lokasi saat tombol ABSEN ditekan (bukan saat halaman dibuka) | ✅ Selesai |
| 11 | Implementasi perhitungan radius (Haversine) + validasi accuracy di server | TEST 3, TEST 4 lulus | ✅ Selesai |
| 12 | Implementasi validasi jam absensi (timezone-aware) + penentuan status HADIR/TERLAMBAT | TEST 8, TEST 9 lulus | ✅ Selesai |
| 13 | Implementasi penyimpanan record + duplicate prevention (unique constraint + cek sebelum insert) | TEST 1, TEST 6 lulus | ✅ Selesai |
| 14 | Buat dashboard admin sederhana (ringkasan angka) | Data ringkasan sesuai isi tabel | ✅ Selesai |
| 15 | Buat filter absensi + export CSV (`/admin/absensi`, `/api/admin/export`) | TEST 12 lulus | ✅ Selesai |
| 16 | Buat `/admin/pengaturan` (school_settings CRUD) | Admin bisa ubah koordinat/radius/jam, langsung mempengaruhi validasi | ✅ Selesai |
| 17 | Testing menyeluruh (Bagian 10), security review RLS & service role | Semua 12 test case lulus, service role key tidak ada di bundle client (`grep` di build output) | ✅ Selesai |
| 18 | Deploy ke Vercel, set env vars, cek HTTPS, tes dari HP asli di lokasi nyata | Absen berhasil dari HP di lokasi sekolah, ditolak di luar radius | ✅ Selesai |
| **19 [BARU]** | Perbaiki kontras teks input di seluruh halaman (Bagian 8.1) | Teks yang diketik di semua input jelas terlihat (`text-gray-900`), placeholder tetap pudar; dicek visual di `/absen` dan semua form admin | ✅ Selesai |
| **20 [BARU]** | Implementasi import siswa: migration `students` (tidak berubah), buat `/api/admin/students/template`, `/api/admin/students/import`, dan halaman `/admin/siswa/import` | Admin bisa download template `.xlsx`, isi, upload, dan melihat ringkasan hasil import (berhasil/dilewati/gagal) sesuai Bagian 6.4 | ✅ Selesai |
| **21 [BARU]** | Implementasi anti-titip-absen device binding: jalankan migration Bagian 3.2, buat `/lib/device.ts`, tambahkan `device_id` ke form `/absen`, tambahkan validasi langkah 7 di Bagian 6.1, tambahkan toggle setting di `/admin/pengaturan` | TEST 13–14 (Bagian 10) lulus; saat setting dimatikan, validasi device binding dilewati sepenuhnya | ✅ Selesai |
| **22 [BARU v1.2]** | Jalankan migration Bagian 3.3 (`student_daily_status`); tambahkan upsert langkah 11 di `/api/absen` (Bagian 6.1); buat `GET/PATCH /api/admin/attendance/status` (Bagian 6.5); update `/admin/absensi` jadi dropdown status editable per siswa | TEST 17–18 (Bagian 10) lulus; admin bisa ubah status siswa dari dropdown dan tersimpan tanpa reload | ✅ Selesai |
| **23 [BARU v1.2]** | Ubah `GET /api/admin/export` dari CSV 1-hari jadi Excel rekap rentang tanggal (Bagian 6.6); update UI `/admin/absensi` jadi input rentang tanggal (dari–sampai) + tombol download rekap | TEST 19 lulus; file `.xlsx` terunduh berisi matriks siswa x tanggal sesuai rentang yang dipilih | ✅ Selesai |

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
| 12 | Export rekap Excel | klik download dengan filter rentang tanggal | **[DIUBAH v1.2]** file `.xlsx` terunduh, struktur rekap sesuai Bagian 6.6 (lihat juga TEST 19 untuk detail) |
| **13 [BARU]** | Device sudah dipakai untuk NIS lain hari ini | `device_id` X submit NIS A (sukses), lalu `device_id` X coba submit NIS B (device binding aktif, max=1) | 400 "Perangkat ini sudah digunakan untuk absensi siswa lain hari ini." |
| **14 [BARU]** | Device binding dimatikan | `enable_device_binding=false`, device sama submit NIS A lalu NIS B | Keduanya berhasil (tidak diblokir) |
| **15 [BARU]** | Import Excel — file valid | Upload `.xlsx` dengan 10 baris valid, kelas cocok | `berhasil: 10`, semua siswa baru muncul di `/admin/siswa` |
| **16 [BARU]** | Import Excel — ada baris invalid | Baris dengan NIS duplikat (sudah ada di DB) & baris dengan nama kelas salah ketik | Baris duplikat masuk `dilewati_duplikat`, baris kelas salah masuk `gagal` dengan alasan jelas, baris lain tetap berhasil |
| **17 [BARU v1.2]** | Admin edit status manual | Admin ubah status siswa A dari "Belum Absen" jadi "Tidak Hadir" untuk tanggal tertentu | `student_daily_status` berisi row baru `status='TIDAK_HADIR'`, `source='MANUAL'`; tabel `/admin/absensi` langsung menampilkan "Tidak Hadir" |
| **18 [BARU v1.2]** | Scan asli menimpa status manual | Siswa B statusnya sudah di-set manual "Tidak Hadir" oleh admin, lalu siswa B benar-benar scan dan lolos semua validasi | Status harian siswa B berubah otomatis jadi `HADIR`, `source='SCAN'` (menimpa status manual sebelumnya) |
| **19 [BARU v1.2]** | Download rekap Excel rentang tanggal | Admin pilih rentang 5 hari, klik download | File `.xlsx` terunduh berisi kolom per tanggal (5 kolom) x semua siswa aktif, status sesuai `student_daily_status`/default Belum Absen, kolom ringkasan total terisi benar |

---

## 11. DEFINITION OF DONE

Gunakan checklist PRD bagian 45 apa adanya — semua 27 item di sana tetap berlaku sebagai kriteria selesai MVP, tidak diubah di rancangan ini.

**Tambahan DoD untuk update v1.1:**
- [ ] Semua teks yang diketik di input field terlihat jelas (kontras cukup) di seluruh halaman.
- [ ] Admin dapat download template Excel dan template berisi kolom yang benar.
- [ ] Admin dapat upload Excel dan mendapat ringkasan hasil import yang jelas (berhasil/dilewati/gagal).
- [ ] Satu device tidak bisa dipakai absen untuk lebih dari `max_students_per_device_per_day` siswa berbeda dalam satu hari, ketika fitur ini aktif.
- [ ] Toggle device binding di pengaturan berfungsi (bisa dinyalakan/dimatikan tanpa mengubah kode).

**Tambahan DoD untuk update v1.2:**
- [ ] Admin bisa mengubah status kehadiran siswa (Hadir/Belum Absen/Tidak Hadir) langsung dari `/admin/absensi`, tersimpan tanpa reload halaman.
- [ ] Status default siswa yang belum ada aktivitas apa pun untuk tanggal tsb adalah "Belum Absen" (tanpa perlu job/cron).
- [ ] Siswa yang benar-benar scan (lolos semua validasi) status hariannya otomatis jadi "Hadir", walau sebelumnya sudah di-set manual berbeda oleh admin.
- [ ] Admin bisa memilih rentang tanggal (dari–sampai) untuk melihat & mengunduh rekap, tidak lagi terbatas 1 hari.
- [ ] File yang diunduh berformat Excel (`.xlsx`), berisi rekap matriks siswa x tanggal beserta kolom ringkasan total, bukan lagi daftar mentah per baris.

---

## 12. PANDUAN MEMBERI PROMPT KE AI CODER MURAH

**Penting**: AI coder tidak punya memori antar sesi chat. Setiap kali kamu buka sesi/chat baru dengannya, dia tidak tahu tahap mana yang sudah selesai — kecuali kamu beri tahu lewat tabel Status di Bagian 9 (kolom `✅ Selesai` / `⬜ Belum`). Selalu update kolom itu setiap satu Tahap selesai dan sudah kamu cek acceptance criteria-nya, lalu tempelkan tabel yang sudah terupdate itu di prompt sesi berikutnya.

Saran urutan prompt (copy-paste per Tahap):

```
Kamu akan mengerjakan proyek "Sistem Absensi Siswa" berdasarkan dokumen rancangan
teknis berikut [tempel Bagian 0–8 dokumen ini sebagai konteks tetap].

Berikut status pengerjaan sejauh ini (tabel Tahap di Bagian 9):
[tempel tabel Bagian 9 yang sudah kamu update kolom Status-nya]

Kerjakan HANYA Tahap <N> yang statusnya masih ⬜ Belum. Jangan mengerjakan
atau mengubah ulang tahap yang statusnya sudah ✅ Selesai, kecuali saya minta.
Setelah selesai: sebutkan file yang dibuat/diubah, tampilkan kode lengkap,
beri instruksi cara menjalankan/testing, lalu berhenti dan tunggu konfirmasi saya.
```

Ulangi untuk Tahap 1 → 23 secara berurutan, update kolom Status tiap kali satu tahap kelar. Jika AI coder menemukan error di tengah jalan, minta dia: *"jelaskan penyebab, beri solusi, jangan ubah arsitektur"* (sesuai PRD poin 48).

---

*Dokumen ini adalah turunan teknis dari PRD asli. Jika ada perubahan scope, ubah PRD asli terlebih dahulu, baru sinkronkan dokumen ini.*

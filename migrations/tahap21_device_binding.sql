-- Tahap 21: Device Binding (anti-titip-absen)
-- Jalankan ini di Supabase SQL Editor

-- Tambah kolom device_id pada attendance_records
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS device_id text NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_attendance_device_date ON attendance_records(device_id, attendance_date);

-- Setting untuk mengaktifkan/menonaktifkan & konfigurasi fitur ini
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS enable_device_binding boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_students_per_device_per_day int NOT NULL DEFAULT 1;

-- Tahap 22: Status Harian Siswa (edit manual oleh admin)
-- Jalankan ini di Supabase SQL Editor

create table if not exists student_daily_status (
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
create index if not exists idx_daily_status_date on student_daily_status(status_date);
create index if not exists idx_daily_status_student on student_daily_status(student_id);

alter table student_daily_status enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='student_daily_status' and policyname='admin_manage_daily_status'
  ) then
    create policy "admin_manage_daily_status" on student_daily_status for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

/**
 * Validasi waktu absensi dengan timezone sekolah
 * Menggunakan Intl.DateTimeFormat untuk mendapatkan waktu lokal sekolah
 */

export interface SchoolTimeSettings {
  attendance_start_time: string  // HH:mm:ss
  late_after_time: string        // HH:mm:ss
  attendance_end_time: string    // HH:mm:ss
  timezone: string               // e.g., 'Asia/Makassar'
}

export interface TimeValidationResult {
  valid: boolean
  message?: string
  status?: 'HADIR' | 'TERLAMBAT' | 'DITOLAK'
  currentTime: string
}

/**
 * Mendapatkan waktu saat ini di timezone sekolah sebagai string HH:mm
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  const now = new Date()
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
}

/**
 * Parse time string (HH:mm:ss atau HH:mm) ke menit dari tengah malam
 */
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  return hours * 60 + minutes
}

/**
 * Validasi waktu absensi dan tentukan status
 */
export function validateAttendanceTime(
  settings: SchoolTimeSettings
): TimeValidationResult {
  const currentTimeStr = getCurrentTimeInTimezone(settings.timezone)
  const currentMinutes = parseTimeToMinutes(currentTimeStr)
  
  const startMinutes = parseTimeToMinutes(settings.attendance_start_time)
  const lateMinutes = parseTimeToMinutes(settings.late_after_time)
  const endMinutes = parseTimeToMinutes(settings.attendance_end_time)

  // Di luar jam absensi
  if (currentMinutes < startMinutes) {
    return {
      valid: false,
      message: 'Absensi belum dibuka.',
      currentTime: currentTimeStr,
    }
  }

  if (currentMinutes > endMinutes) {
    return {
      valid: false,
      message: 'Absensi sudah ditutup.',
      currentTime: currentTimeStr,
    }
  }

  // Tentukan status
  let status: 'HADIR' | 'TERLAMBAT'
  if (currentMinutes <= lateMinutes) {
    status = 'HADIR'
  } else {
    status = 'TERLAMBAT'
  }

  return {
    valid: true,
    status,
    currentTime: currentTimeStr,
  }
}
const KEY = 'absensi_device_id'

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'unknown'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

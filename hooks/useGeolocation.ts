'use client'

import { useState, useEffect } from 'react'

interface GeoLocation {
  latitude: number
  longitude: number
  accuracy: number
}

interface UseGeolocationReturn {
  supported: boolean
  getLocation: () => Promise<GeoLocation>
}

export function useGeolocation(): UseGeolocationReturn {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    setSupported('geolocation' in navigator)
  }, [])

  const getLocation = (): Promise<GeoLocation> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Browser tidak mendukung GPS'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
        },
        (error) => {
          let message = 'Gagal mendapatkan lokasi'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Lokasi tidak diizinkan. Silakan aktifkan lokasi dan izinkan browser mengakses lokasi.'
              break
            case error.POSITION_UNAVAILABLE:
              message = 'Lokasi tidak tersedia. Silakan coba lagi di area terbuka.'
              break
            case error.TIMEOUT:
              message = 'Waktu permintaan lokasi habis. Silakan coba lagi.'
              break
          }
          reject(new Error(message))
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }

  return { supported, getLocation }
}

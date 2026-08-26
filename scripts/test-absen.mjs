const testCases = [
  { 
    token: '039670f4-00f0-40d3-8806-683b733397c5', 
    nis: '12347', 
    latitude: -6.2088, 
    longitude: 106.8456, 
    accuracy: 10,
    desc: 'TEST 1: Semua valid -> HADIR/TERLAMBAT tersimpan' 
  },
  { 
    token: '039670f4-00f0-40d3-8806-683b733397c5', 
    nis: '99999', 
    latitude: -6.2088, 
    longitude: 106.8456, 
    accuracy: 10,
    desc: 'TEST 2: NIS invalid -> ditolak' 
  },
  { 
    token: '039670f4-00f0-40d3-8806-683b733397c5', 
    nis: '12345', 
    latitude: -6.2200, 
    longitude: 106.8500, 
    accuracy: 10,
    desc: 'TEST 3: Di luar radius -> ditolak' 
  },
  { 
    token: '039670f4-00f0-40d3-8806-683b733397c5', 
    nis: '12345', 
    latitude: -6.2088, 
    longitude: 106.8456, 
    accuracy: 200,
    desc: 'TEST 4: Accuracy buruk -> ditolak' 
  },
  { 
    token: 'invalid-token', 
    nis: '12345',
    latitude: -6.2088, 
    longitude: 106.8456, 
    accuracy: 10,
    desc: 'TEST 5: Token expired/nonaktif -> ditolak' 
  },
  { 
    token: '039670f4-00f0-40d3-8806-683b733397c5', 
    nis: '12345',
    latitude: -6.2088, 
    longitude: 106.8456, 
    accuracy: 10,
    desc: 'TEST 6: Sudah absen -> ditolak' 
  },
  { 
    token: '039670f4-00f0-40d3-8806-683b733397c5', 
    nis: '12345',
    latitude: -6.2088, 
    longitude: 106.8456, 
    accuracy: 10,
    desc: 'TEST 7: Siswa nonaktif -> ditolak' 
  },
]

async function test() {
  for (const tc of testCases) {
    try {
      const res = await fetch('http://localhost:3000/api/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: tc.token, 
          nis: tc.nis,
          latitude: tc.latitude,
          longitude: tc.longitude,
          accuracy: tc.accuracy,
        })
      })
      const data = await res.json()
      console.log(`${tc.desc}: ${res.status} - ${data.message} ${data.data?.status ? `(${data.data.status})` : ''}`)
    } catch (e) {
      console.log(`${tc.desc}: ERROR - ${e.message}`)
    }
  }
}

test()
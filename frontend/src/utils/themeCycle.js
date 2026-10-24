// UpBeat Dynamic Day/Night Cycle & Appearance Theme Engine
// - Morning (4:00 AM - 11:59 AM): Crimson Sunrise (The signature red grid aesthetic)
// - Afternoon / Sunset (12:00 PM - 7:59 PM): Radiant Azure Sky & Solar Gold
// - Night (8:00 PM - 3:59 AM): Cosmic Midnight Violet & Neon Indigo

export function getStoredThemeMode() {
  if (typeof window === 'undefined') return 'dark'
  try {
    return localStorage.getItem('upbeat_theme_mode') || 'dark'
  } catch {
    return 'dark'
  }
}

export function setStoredThemeMode(mode) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('upbeat_theme_mode', mode)
  } catch {}
  applyThemeMode(mode)
}

export function applyThemeMode(mode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'light') {
    root.classList.add('theme-light')
    root.classList.remove('dark')
  } else {
    root.classList.remove('theme-light')
    root.classList.add('dark')
  }
}

export function getDayNightThemeInfo() {
  const hour = new Date().getHours() // 0 - 23

  if (hour >= 4 && hour < 12) {
    return {
      id: 'theme-morning',
      label: 'Sunrise Crimson',
      timeSlot: 'Morning (4 AM – 12 PM)',
      type: 'morning',
      color: '#ef4444',
      accentColor: '#f43f5e'
    }
  } else if (hour >= 12 && hour < 20) {
    return {
      id: 'theme-afternoon',
      label: 'Radiant Azure & Gold',
      timeSlot: 'Afternoon (12 PM – 8 PM)',
      type: 'afternoon',
      color: '#0ea5e9',
      accentColor: '#f59e0b'
    }
  } else {
    return {
      id: 'theme-night',
      label: 'Cosmic Midnight Violet',
      timeSlot: 'Night (8 PM – 4 AM)',
      type: 'night',
      color: '#8b5cf6',
      accentColor: '#6366f1'
    }
  }
}

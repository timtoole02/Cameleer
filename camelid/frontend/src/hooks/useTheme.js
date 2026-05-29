import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('camelid-theme') || 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('camelid-theme', theme)
  }, [theme])

  return { theme, setTheme }
}

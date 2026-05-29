import { useState } from 'react'

export function useNotice() {
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState('info')

  const showNotice = (message, tone = 'info') => {
    setNotice(message)
    setNoticeTone(tone)
  }

  const clearNotice = () => setNotice('')

  return {
    notice,
    noticeTone,
    showNotice,
    clearNotice,
  }
}

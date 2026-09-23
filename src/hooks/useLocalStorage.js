import { useEffect, useState } from 'react'

/**
 * Keep React state under a browser storage key, returning the value and its setter.
 * Missing or unreadable stored values use the initial value; subsequent writes are not caught.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

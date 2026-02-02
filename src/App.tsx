import { useEffect } from 'react'
import Home from './app/Home'

export default function App() {
  useEffect(() => {
    // Load eruda for mobile debugging (optional - remove in production)
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/eruda'
    script.onload = () => {
      // @ts-expect-error eruda exists on window after script loads
      window.eruda?.init()
    }
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  return <Home />
}

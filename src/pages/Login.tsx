import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export function LoginPage() {
  const { signIn, signInWithApiKey } = useAuth()
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleApiKeyLogin = async () => {
    if (!apiKey.trim()) return
    setError('')
    setLoading(true)
    try {
      await signInWithApiKey(apiKey.trim())
    } catch {
      setError('Invalid API key. Check the key and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <img src="/favicon.svg" alt="Tempo" className="w-16 h-16 mx-auto mb-4" />
        <h1 className="font-display text-4xl font-bold text-primary tracking-tight mb-3">
          Tempo
        </h1>
        <p className="text-on-surface-variant text-sm mb-10 leading-relaxed">
          One calm place to capture, focus, and act.
        </p>

        <button
          onClick={signIn}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-br from-primary to-primary-dim text-on-primary font-medium text-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
        >
          Sign in with Google
        </button>

        <div className="mt-6">
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="text-on-surface-variant text-xs hover:text-on-surface transition-colors duration-200 cursor-pointer"
          >
            {showApiKey ? 'Hide API key login' : 'Sign in with API key'}
          </button>

          {showApiKey && (
            <div className="mt-3 space-y-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError('') }}
                placeholder="Paste your API key"
                className="w-full bg-surface-container-lowest rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleApiKeyLogin()}
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-xs">{error}</p>
              )}
              <button
                onClick={handleApiKeyLogin}
                disabled={loading || !apiKey.trim()}
                className="w-full py-3 px-6 rounded-xl bg-surface-container-lowest text-on-surface font-medium text-sm hover:bg-surface-container-low transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
              <p className="text-on-surface-variant/50 text-xs">
                Generate a key from Settings on a device where you can sign in with Google
              </p>
            </div>
          )}
        </div>

        <p className="text-on-surface-variant/60 text-xs mt-8">
          Your data stays yours. Always exportable.
        </p>
      </div>
    </div>
  )
}

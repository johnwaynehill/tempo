import { useAuth } from '@/context/AuthContext'

export function LoginPage() {
  const { signIn } = useAuth()

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

        <p className="text-on-surface-variant/60 text-xs mt-8">
          Your data stays yours. Always exportable.
        </p>
      </div>
    </div>
  )
}

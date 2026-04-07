import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

const DEV_AUTH_TOKEN = import.meta.env.VITE_DEV_AUTH_TOKEN as string | undefined
const IS_DEV_AUTH = !!DEV_AUTH_TOKEN

// Minimal mock that satisfies the User type for components that read .uid, .email, .displayName
const DEV_USER = {
  uid: 'dev-test-user',
  email: 'dev@tempo.test',
  displayName: 'Dev User',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  providerId: 'dev',
  refreshToken: '',
  tenantId: null,
  phoneNumber: null,
  delete: async () => {},
  getIdToken: async () => DEV_AUTH_TOKEN!,
  getIdTokenResult: async () => ({ token: DEV_AUTH_TOKEN!, claims: {}, authTime: '', issuedAtTime: '', expirationTime: '', signInProvider: null, signInSecondFactor: null }),
  reload: async () => {},
  toJSON: () => ({}),
} as unknown as User

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(IS_DEV_AUTH ? DEV_USER : null)
  const [loading, setLoading] = useState(!IS_DEV_AUTH)

  useEffect(() => {
    if (IS_DEV_AUTH) return
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async () => {
    if (IS_DEV_AUTH) return
    await signInWithPopup(auth, googleProvider)
  }

  const signOut = async () => {
    if (IS_DEV_AUTH) {
      setUser(null)
      return
    }
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

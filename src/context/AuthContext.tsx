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
import { api, setStoredApiKey, clearStoredApiKey, getStoredApiKey } from '@/lib/api'

const DEV_AUTH_TOKEN = import.meta.env.VITE_DEV_AUTH_TOKEN as string | undefined
const IS_DEV_AUTH = !!DEV_AUTH_TOKEN

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

function makeApiKeyUser(profile: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): User {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    providerId: 'api-key',
    refreshToken: '',
    tenantId: null,
    phoneNumber: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({ token: '', claims: {}, authTime: '', issuedAtTime: '', expirationTime: '', signInProvider: null, signInSecondFactor: null }),
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signInWithApiKey: (apiKey: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(IS_DEV_AUTH ? DEV_USER : null)
  const [loading, setLoading] = useState(!IS_DEV_AUTH)

  useEffect(() => {
    if (IS_DEV_AUTH) return

    const storedKey = getStoredApiKey()
    if (storedKey) {
      api.auth.me()
        .then((profile) => {
          setUser(makeApiKeyUser(profile))
          setLoading(false)
        })
        .catch(() => {
          clearStoredApiKey()
          setLoading(false)
        })
      return
    }

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

  const signInWithApiKey = async (apiKey: string) => {
    setStoredApiKey(apiKey)
    try {
      const profile = await api.auth.me()
      setUser(makeApiKeyUser(profile))
    } catch {
      clearStoredApiKey()
      throw new Error('Invalid API key')
    }
  }

  const signOut = async () => {
    if (IS_DEV_AUTH) {
      setUser(null)
      return
    }
    clearStoredApiKey()
    if (auth.currentUser) {
      await firebaseSignOut(auth)
    } else {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithApiKey, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

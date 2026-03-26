import { useAuth } from '@/context/AuthContext'

export function SettingsPage() {
  const { user } = useAuth()

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Settings
        </h1>
      </div>

      {/* Account */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">Account</h2>
        {user && (
          <div className="flex items-center gap-4 bg-surface-container-lowest rounded-xl p-5">
            <img
              src={user.photoURL ?? ''}
              alt=""
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="text-on-surface text-sm font-medium">{user.displayName}</p>
              <p className="text-on-surface-variant text-xs">{user.email}</p>
            </div>
          </div>
        )}
      </section>

      {/* Data */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">Data</h2>
        <div className="space-y-3">
          <button className="w-full text-left bg-surface-container-lowest rounded-xl p-5 hover:bg-surface-container-low transition-colors duration-200 cursor-pointer">
            <p className="text-on-surface text-sm font-medium">Import from Coda (CSV)</p>
            <p className="text-on-surface-variant text-xs mt-0.5">One-time migration from your Coda workspace</p>
          </button>
          <button className="w-full text-left bg-surface-container-lowest rounded-xl p-5 hover:bg-surface-container-low transition-colors duration-200 cursor-pointer">
            <p className="text-on-surface text-sm font-medium">Export data</p>
            <p className="text-on-surface-variant text-xs mt-0.5">Download todos as JSON + notes as Markdown files</p>
          </button>
        </div>
      </section>

      {/* Preferences */}
      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold text-on-surface mb-4">Preferences</h2>
        <div className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Theme</p>
              <p className="text-on-surface-variant text-xs">Light mode only for now</p>
            </div>
            <span className="text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-lg">
              Coming soon
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-on-surface text-sm font-medium">Notifications</p>
              <p className="text-on-surface-variant text-xs">Gentle reminders (Mac only)</p>
            </div>
            <span className="text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-lg">
              Coming soon
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { FAB } from './FAB'

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />

      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="max-w-2xl mx-auto px-5 md:px-10 py-8 md:py-12">
          <Outlet />
        </div>
      </main>

      <FAB />
      <BottomNav />
    </div>
  )
}

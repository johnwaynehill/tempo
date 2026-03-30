import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/context/AuthContext'
import { TodosProvider } from '@/context/TodosContext'
import { NotesProvider } from '@/context/NotesContext'
import { HabitsProvider } from '@/context/HabitsContext'
import { EventsProvider } from '@/context/EventsContext'
import { PreferencesProvider } from '@/context/PreferencesContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PreferencesProvider>
        <TodosProvider>
          <NotesProvider>
            <HabitsProvider>
              <EventsProvider>
                <App />
              </EventsProvider>
            </HabitsProvider>
          </NotesProvider>
        </TodosProvider>
      </PreferencesProvider>
    </AuthProvider>
  </StrictMode>,
)

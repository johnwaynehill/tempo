import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/context/AuthContext'
import { TodosProvider } from '@/context/TodosContext'
import { NotesProvider } from '@/context/NotesContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <TodosProvider>
        <NotesProvider>
          <App />
        </NotesProvider>
      </TodosProvider>
    </AuthProvider>
  </StrictMode>,
)

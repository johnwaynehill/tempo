import { useOutletContext } from 'react-router'

export function useMenuOpen() {
  const { onMenuOpen } = useOutletContext<{ onMenuOpen: () => void }>()
  return onMenuOpen
}

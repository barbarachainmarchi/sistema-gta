import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR')
}

export function norm(s: string | null | undefined): string {
  if (!s) return ''
  // eslint-disable-next-line no-misleading-character-class
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

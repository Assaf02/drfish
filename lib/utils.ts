import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export type Period = 'today' | '7d' | '30d' | 'month' | 'custom';

export function periodToDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case 'today':  return { from: startOfDay(now), to: endOfDay(now) };
    case '7d':     return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'month':  return { from: startOfMonth(now), to: endOfMonth(now) };
    default:       return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }; // 30d
  }
}

export function getPeriodLabel(period: string, fromISO?: string, toISO?: string): string {
  switch (period) {
    case 'today':  return "Aujourd'hui";
    case '7d':     return '7 derniers jours';
    case '30d':    return '30 derniers jours';
    case 'month':  return 'Ce mois';
    case 'custom':
      if (fromISO && toISO) {
        const f = format(new Date(fromISO + 'T12:00:00'), 'd MMM', { locale: fr });
        const t = format(new Date(toISO + 'T12:00:00'), 'd MMM yyyy', { locale: fr });
        return `${f} – ${t}`;
      }
      return 'Période personnalisée';
    default: return '30 derniers jours';
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCFA(amount: number): string {
  const n = Math.round(amount);
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const str = Number.isInteger(m) ? `${m}` : m.toFixed(1).replace('.', ',');
    return `${str}M FCFA`;
  }
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-BJ').format(n);
}

export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  return format(new Date(date), fmt, { locale: fr });
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'dd/MM/yyyy à HH:mm', { locale: fr });
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

export function getDateRange(period: 'today' | 'week' | 'month') {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfWeek(now, { locale: fr }), end: endOfWeek(now, { locale: fr }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export function calcMargin(purchasePrice: number, sellingPrice: number): number {
  if (purchasePrice === 0) return 0;
  return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
}

export function calcProfit(purchasePrice: number, sellingPrice: number, quantity: number): number {
  return (sellingPrice - purchasePrice) * quantity;
}

export function getPaymentStatusLabel(status: string): string {
  return status === 'PAID' ? 'Payé' : 'En attente';
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    WHATSAPP: 'WhatsApp',
    WEBSITE: 'Site web',
    DIRECT: 'Direct',
  };
  return labels[method] ?? method;
}

export function getCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    POISSON: 'Poisson',
    CRUSTACE: 'Crustacé',
    AUTRE: 'Autre',
  };
  return labels[cat] ?? cat;
}

export function getSubscriptionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Actif',
    SUSPENDED: 'Suspendu',
    EXPIRED: 'Expiré',
  };
  return labels[status] ?? status;
}

export function calcSalary(orderCount: number, baseSalary = 25000): number {
  if (orderCount < 50) return 0;
  let bonus = 0;
  if (orderCount >= 70) bonus = baseSalary * 0.1;
  else if (orderCount >= 60) bonus = baseSalary * 0.05;
  return baseSalary + bonus;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

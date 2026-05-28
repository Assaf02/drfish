'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DataPoint {
  date: string;
  label?: string;
  revenue: number;
  orders: number;
}

function formatCFAShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { date: string } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const dateStr = payload[0]?.payload?.date;
  const label = dateStr ? format(new Date(dateStr), 'EEE dd MMM', { locale: fr }) : '';
  return (
    <div className="bg-navy text-white rounded-xl px-4 py-3 shadow-float text-sm">
      <p className="text-white/60 text-xs mb-1">
        {label}
      </p>
      <p className="font-bold">{new Intl.NumberFormat('fr-BJ', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(payload[0].value)}</p>
      {payload[1] && <p className="text-white/60 text-xs">{payload[1].value} commandes</p>}
    </div>
  );
}

export function RevenueChart({ data, type = 'area' }: { data: DataPoint[]; type?: 'area' | 'bar' }) {
  const formatted = data.map((d) => ({
    ...d,
    label: d.label ?? format(new Date(d.date), 'EEE', { locale: fr }),
  }));

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={formatted} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={formatCFAShort} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="revenue" fill="#2E6DB4" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2E6DB4" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#2E6DB4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={formatCFAShort} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="revenue" stroke="#2E6DB4" strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: '#2E6DB4' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

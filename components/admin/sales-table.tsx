'use client';

import { useState, useMemo } from 'react';
import { formatCFA, formatDateTime, getPaymentStatusLabel, getPaymentMethodLabel, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { updateSale, deleteSale } from '@/app/actions/sales';
import { toast } from 'sonner';
import { Search, Filter, Download, Eye, Edit2, Trash2, X, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Sale = {
  id: string; date: Date; totalAmount: number; paymentStatus: string; paymentMethod: string; notes: string | null;
  agent: { id: string; name: string }; client: { id: string; name: string; phone: string | null } | null;
  items: Array<{ id: string; quantity: number; pricePerKg: number; subtotal: number; product: { id: string; name: string; category: string; purchasePrice: number } }>;
  services: Array<{ id: string; price: number; service: { id: string; name: string } }>;
};
type Agent = { id: string; name: string };
type Product = { id: string; name: string };

export function SalesTable({ initialSales, total, agents, products }: { initialSales: Sale[]; total: number; agents: Agent[]; products: Product[] }) {
  const [sales, setSales] = useState(initialSales);
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => sales.filter((s) => {
    const matchSearch = !search || s.client?.name.toLowerCase().includes(search.toLowerCase()) ||
      s.items.some((i) => i.product.name.toLowerCase().includes(search.toLowerCase()));
    const matchAgent = !filterAgent || s.agent.id === filterAgent;
    const matchStatus = !filterStatus || s.paymentStatus === filterStatus;
    return matchSearch && matchAgent && matchStatus;
  }), [sales, search, filterAgent, filterStatus]);

  const totalRevenue = filtered.reduce((sum, s) => sum + s.totalAmount, 0);

  const handleMarkPaid = async (id: string) => {
    setLoading(id);
    try {
      await updateSale(id, { paymentStatus: 'PAID' });
      setSales((prev) => prev.map((s) => s.id === id ? { ...s, paymentStatus: 'PAID' } : s));
      toast.success('Marqué comme payé');
    } catch { toast.error('Erreur'); } finally { setLoading(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette vente ?')) return;
    setLoading(id);
    try {
      await deleteSale(id);
      setSales((prev) => prev.filter((s) => s.id !== id));
      if (viewSale?.id === id) setViewSale(null);
      toast.success('Vente supprimée');
    } catch { toast.error('Erreur'); } finally { setLoading(null); }
  };

  const exportCSV = () => {
    const rows = [
      ['Date', 'Client', 'Agent', 'Produits', 'Total', 'Statut', 'Méthode'],
      ...filtered.map((s) => [
        new Date(s.date).toLocaleDateString('fr-FR'),
        s.client?.name ?? 'Anonyme',
        s.agent.name,
        s.items.map((i) => `${i.product.name} ${i.quantity}kg`).join(' + '),
        s.totalAmount,
        getPaymentStatusLabel(s.paymentStatus),
        getPaymentMethodLabel(s.paymentMethod),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ventes-drfish.csv'; a.click();
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 text-center">
          <p className="text-2xl font-bold text-navy">{filtered.length}</p>
          <p className="text-xs text-gray-500">ventes filtrées</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 text-center">
          <p className="text-2xl font-bold text-navy">{formatCFA(totalRevenue)}</p>
          <p className="text-xs text-gray-500">total filtré</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 text-center">
          <p className="text-2xl font-bold text-warning">
            {filtered.filter((s) => s.paymentStatus === 'PENDING').length}
          </p>
          <p className="text-xs text-gray-500">en attente</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client, produit..." className="input-field pl-9 py-2.5 text-sm" />
        </div>
        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="input-field py-2.5 text-sm min-w-36">
          <option value="">Tous les agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field py-2.5 text-sm min-w-36">
          <option value="">Tous statuts</option>
          <option value="PAID">Payé</option>
          <option value="PENDING">En attente</option>
        </select>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 py-2.5 text-sm">
          <Download size={15} /> CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Produits</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Agent</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">Aucune vente trouvée</td></tr>
              ) : filtered.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(sale.date)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-navy">{sale.client?.name ?? <span className="text-gray-400">Anonyme</span>}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                    <span className="truncate block">{sale.items.map((i) => `${i.product.name} ×${i.quantity}kg`).join(', ')}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{sale.agent.name}</td>
                  <td className="px-4 py-3 text-sm font-bold text-navy text-right whitespace-nowrap">{formatCFA(sale.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={sale.paymentStatus === 'PAID' ? 'green' : 'orange'} dot>
                      {getPaymentStatusLabel(sale.paymentStatus)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setViewSale(sale)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-navy transition-colors">
                        <Eye size={15} />
                      </button>
                      {sale.paymentStatus === 'PENDING' && (
                        <button onClick={() => handleMarkPaid(sale.id)} disabled={loading === sale.id}
                          className="p-1.5 rounded-lg hover:bg-success-light text-gray-400 hover:text-success transition-colors" title="Marquer payé">
                          ✓
                        </button>
                      )}
                      <button onClick={() => handleDelete(sale.id)} disabled={loading === sale.id}
                        className="p-1.5 rounded-lg hover:bg-danger-light text-gray-400 hover:text-danger transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail dialog */}
      {viewSale && (
        <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Détail de la vente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-400">Client</p><p className="font-semibold text-navy">{viewSale.client?.name ?? 'Anonyme'}</p></div>
                <div><p className="text-gray-400">Agent</p><p className="font-semibold text-navy">{viewSale.agent.name}</p></div>
                <div><p className="text-gray-400">Date</p><p className="font-semibold text-navy">{formatDateTime(viewSale.date)}</p></div>
                <div><p className="text-gray-400">Méthode</p><p className="font-semibold text-navy">{getPaymentMethodLabel(viewSale.paymentMethod)}</p></div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Produits</p>
                <div className="space-y-1.5">
                  {viewSale.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-navy">{item.product.name} × {item.quantity} kg</span>
                      <span className="font-semibold text-navy">{formatCFA(item.subtotal)}</span>
                    </div>
                  ))}
                  {viewSale.services.map((svc) => (
                    <div key={svc.id} className="flex justify-between text-sm">
                      <span className="text-gray-500">{svc.service.name}</span>
                      <span className="font-semibold text-navy">{formatCFA(svc.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between">
                <span className="font-bold text-navy">Total</span>
                <span className="font-bold text-xl text-navy">{formatCFA(viewSale.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <Badge variant={viewSale.paymentStatus === 'PAID' ? 'green' : 'orange'} dot>
                  {getPaymentStatusLabel(viewSale.paymentStatus)}
                </Badge>
                {viewSale.paymentStatus === 'PENDING' && (
                  <button onClick={() => { handleMarkPaid(viewSale.id); setViewSale(null); }} className="btn-primary text-sm py-2">
                    Marquer comme payé
                  </button>
                )}
              </div>
              {viewSale.notes && <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">{viewSale.notes}</p>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

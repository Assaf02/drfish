'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Check, Plus, Minus, Fish, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { getProducts } from '@/app/actions/products';
import { getServices } from '@/app/actions/services';
import { getClients } from '@/app/actions/clients';
import { createSale } from '@/app/actions/sales';
import { formatCFA, cn, getCategoryLabel } from '@/lib/utils';

type Product = { id: string; name: string; sellingPrice: number; category: string };
type Service = { id: string; name: string; price: number; promoPrice: number | null; isPromo: boolean };
type Client = { id: string; name: string; phone: string | null };

interface CartItem { product: Product; quantity: number }

interface PendingSale {
  _key: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  paymentStatus: 'PAID' | 'PENDING';
  paymentMethod: 'DIRECT' | 'WHATSAPP' | 'WEBSITE';
  notes?: string;
  cart: CartItem[];
  serviceIds: string[];
  totalKg: number;
  total: number;
}

// Returns price per kg (promo or normal)
function getServicePricePerKg(s: Service) {
  return s.isPromo && s.promoPrice != null ? s.promoPrice : s.price;
}

export default function NewSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Form state (Section A)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState<'DIRECT' | 'WHATSAPP' | 'WEBSITE'>('DIRECT');
  const [notes, setNotes] = useState('');

  // Pending list (Section B)
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successTotal, setSuccessTotal] = useState(0);

  useEffect(() => {
    Promise.all([getProducts(), getServices(), getClients()]).then(([p, s, c]) => {
      setProducts(p);
      setServices(s);
      setClients(c as Client[]);
    });
  }, []);

  const categories = Array.from(new Set(products.map((p) => p.category)));

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 0.5 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.product.id !== productId) return i;
      const q = Math.round((i.quantity + delta) * 10) / 10;
      return { ...i, quantity: Math.max(0.5, q) };
    }));
  };

  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((i) => i.product.id !== productId));

  const toggleService = (id: string) => setSelectedServiceIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const totalKg = cart.reduce((sum, i) => sum + i.quantity, 0);
  const itemsTotal = cart.reduce((sum, i) => sum + i.product.sellingPrice * i.quantity, 0);
  const servicesTotal = services
    .filter((s) => selectedServiceIds.has(s.id))
    .reduce((sum, s) => sum + getServicePricePerKg(s) * totalKg, 0);
  const formTotal = itemsTotal + servicesTotal;

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(clientSearch))
  );

  const resetForm = () => {
    setCart([]);
    setSelectedServiceIds(new Set());
    setSelectedClientId('');
    setNewClientName('');
    setNewClientPhone('');
    setClientSearch('');
    setShowSearch(false);
    setNotes('');
    setPaymentStatus('PAID');
    setPaymentMethod('DIRECT');
  };

  const handleAjouter = () => {
    if (cart.length === 0) { toast.error('Ajoutez au moins un produit'); return; }
    const sale: PendingSale = {
      _key: Date.now().toString(),
      clientId: selectedClientId || undefined,
      clientName: !selectedClientId ? newClientName || undefined : undefined,
      clientPhone: !selectedClientId ? newClientPhone || undefined : undefined,
      paymentStatus,
      paymentMethod,
      notes: notes || undefined,
      cart: [...cart],
      serviceIds: Array.from(selectedServiceIds),
      totalKg,
      total: formTotal,
    };
    setPendingSales((prev) => [...prev, sale]);
    toast.success('Vente ajoutée à la liste');
    resetForm();
  };

  const removePending = (key: string) => setPendingSales((prev) => prev.filter((s) => s._key !== key));

  const pendingTotal = pendingSales.reduce((sum, s) => sum + s.total, 0);

  const handleConfirm = async () => {
    if (pendingSales.length === 0) return;
    setIsSubmitting(true);
    try {
      await Promise.all(pendingSales.map((sale) =>
        createSale({
          clientId: sale.clientId,
          clientName: sale.clientName,
          clientPhone: sale.clientPhone,
          paymentStatus: sale.paymentStatus,
          paymentMethod: sale.paymentMethod,
          notes: sale.notes,
          totalAmount: sale.total,
          items: sale.cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            pricePerKg: item.product.sellingPrice,
            subtotal: item.product.sellingPrice * item.quantity,
          })),
          services: services
            .filter((s) => sale.serviceIds.includes(s.id))
            .map((s) => ({ serviceId: s.id, price: getServicePricePerKg(s) * sale.totalKg })),
        })
      ));
      setSuccessTotal(pendingTotal);
      setPendingSales([]);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-in"
        style={{ background: 'var(--off-white)' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(26,122,74,0.12)' }}>
          <Check size={48} style={{ color: 'var(--green)' }} />
        </div>
        <h2 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--navy)' }}>Ventes enregistrées !</h2>
        <p className="text-sm text-center" style={{ color: 'var(--gray-400)' }}>
          {formatCFA(successTotal)} — Toutes les ventes ont été confirmées
        </p>
      </div>
    );
  }

  return (
    <div className="pb-safe animate-fade-in" style={{ background: 'var(--off-white)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-4 flex items-center justify-between"
        style={{ background: 'var(--white)', borderBottom: '1px solid var(--gray-100)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <h1 className="text-lg font-extrabold" style={{ color: 'var(--navy)' }}>Nouvelle vente</h1>
        {formTotal > 0 && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ background: 'var(--blue)' }}>
            {formatCFA(formTotal)}
          </span>
        )}
      </div>

      {/* ── Section A: Form ── */}
      <div className="px-4 pt-5 space-y-5">

        {/* Products */}
        <div>
          <p className="label">Produits</p>
          {categories.map((cat) => (
            <div key={cat} className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--gray-400)' }}>
                {getCategoryLabel(cat)}
              </p>
              <div className="space-y-2">
                {products.filter((p) => p.category === cat).map((product) => {
                  const cartItem = cart.find((i) => i.product.id === product.id);
                  return (
                    <div key={product.id}
                      className={cn('flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-150')}
                      style={{
                        background: cartItem ? 'rgba(46,109,180,0.04)' : 'var(--white)',
                        borderColor: cartItem ? 'rgba(46,109,180,0.25)' : 'var(--gray-100)',
                        boxShadow: cartItem ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
                      }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(46,109,180,0.08)' }}>
                        <Fish size={17} style={{ color: 'var(--blue)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--navy)' }}>{product.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>{formatCFA(product.sellingPrice)}/kg</p>
                      </div>
                      {cartItem ? (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => updateQty(product.id, -0.5)}
                            className="w-8 h-8 rounded-xl border flex items-center justify-center active:scale-90 transition-transform"
                            style={{ background: 'var(--white)', borderColor: 'var(--gray-100)' }}>
                            <Minus size={13} style={{ color: 'var(--navy)' }} />
                          </button>
                          <span className="text-sm font-extrabold w-10 text-center" style={{ color: 'var(--navy)' }}>
                            {cartItem.quantity}kg
                          </span>
                          <button type="button" onClick={() => updateQty(product.id, 0.5)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                            style={{ background: 'var(--blue)' }}>
                            <Plus size={13} className="text-white" />
                          </button>
                          <button type="button" onClick={() => removeFromCart(product.id)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-transform ml-0.5"
                            style={{ background: '#fee2e2' }}>
                            <X size={13} style={{ color: 'var(--red)' }} />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => addToCart(product)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                          style={{ background: 'var(--navy)' }}>
                          <Plus size={17} className="text-white" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div>
            <p className="label">Préparation</p>
            <div className="space-y-2">
              {services.map((service) => {
                const pricePerKg = getServicePricePerKg(service);
                const computedTotal = pricePerKg * totalKg;
                const isSelected = selectedServiceIds.has(service.id);
                return (
                  <button type="button" key={service.id} onClick={() => toggleService(service.id)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all active:scale-[0.98]"
                    style={{
                      background: isSelected ? 'rgba(26,122,74,0.06)' : 'var(--white)',
                      borderColor: isSelected ? 'rgba(26,122,74,0.25)' : 'var(--gray-100)',
                    }}>
                    <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        background: isSelected ? 'var(--green)' : 'transparent',
                        borderColor: isSelected ? 'var(--green)' : 'var(--gray-100)',
                      }}>
                      {isSelected && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'var(--navy)' }}>{service.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>
                        {service.isPromo && service.promoPrice != null ? (
                          <span>
                            <span className="line-through mr-1">{formatCFA(service.price)}/kg</span>
                            <span style={{ color: 'var(--green)' }}>
                              {service.promoPrice === 0 ? 'Gratuit' : `${formatCFA(service.promoPrice)}/kg`}
                            </span>
                          </span>
                        ) : (
                          `${formatCFA(pricePerKg)}/kg`
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      {totalKg > 0 ? (
                        <>
                          <p className="text-sm font-extrabold" style={{ color: isSelected ? 'var(--green)' : 'var(--navy)' }}>
                            {computedTotal === 0 ? 'Gratuit' : formatCFA(computedTotal)}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--gray-400)' }}>
                            pour {totalKg} kg
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold" style={{ color: 'var(--gray-400)' }}>
                          — /kg
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Client */}
        <div>
          <p className="label">Client (optionnel)</p>
          {selectedClient ? (
            <div className="flex items-center gap-3 p-3.5 rounded-xl border"
              style={{ background: 'rgba(46,109,180,0.04)', borderColor: 'rgba(46,109,180,0.2)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: 'var(--blue)' }}>
                {selectedClient.name[0]}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--navy)' }}>{selectedClient.name}</p>
                {selectedClient.phone && <p className="text-xs" style={{ color: 'var(--gray-400)' }}>{selectedClient.phone}</p>}
              </div>
              <button type="button" onClick={() => { setSelectedClientId(''); setClientSearch(''); }}>
                <X size={17} style={{ color: 'var(--gray-400)' }} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button type="button" onClick={() => setShowSearch(!showSearch)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left"
                style={{ background: 'var(--white)', borderColor: 'var(--gray-100)' }}>
                <span className="flex-1 text-sm" style={{ color: 'var(--gray-400)' }}>Rechercher un client existant...</span>
                {showSearch ? <ChevronUp size={15} style={{ color: 'var(--gray-400)' }} /> : <ChevronDown size={15} style={{ color: 'var(--gray-400)' }} />}
              </button>
              {showSearch && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--gray-100)', background: 'var(--white)' }}>
                  <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Nom ou téléphone..."
                    className="w-full px-4 py-3 text-sm focus:outline-none border-b"
                    style={{ borderColor: 'var(--gray-100)' }} />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredClients.slice(0, 8).map((client) => (
                      <button type="button" key={client.id}
                        onClick={() => { setSelectedClientId(client.id); setShowSearch(false); }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 border-b last:border-0 transition-colors hover:bg-[var(--gray-50)]"
                        style={{ borderColor: 'var(--gray-50)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'rgba(46,109,180,0.08)', color: 'var(--blue)' }}>
                          {client.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>{client.name}</p>
                          {client.phone && <p className="text-xs" style={{ color: 'var(--gray-400)' }}>{client.phone}</p>}
                        </div>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="px-4 py-3 text-sm" style={{ color: 'var(--gray-400)' }}>Aucun client trouvé</p>
                    )}
                  </div>
                </div>
              )}
              {!showSearch && (
                <div className="grid grid-cols-2 gap-2">
                  <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Nouveau client..." className="input-field text-sm" />
                  <input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Téléphone..." inputMode="tel" className="input-field text-sm" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment */}
        <div>
          <p className="label">Paiement</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              {(['PAID', 'PENDING'] as const).map((s) => (
                <button type="button" key={s} onClick={() => setPaymentStatus(s)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold text-sm transition-all active:scale-[0.98]"
                  style={{
                    background: paymentStatus === s ? (s === 'PAID' ? 'rgba(26,122,74,0.08)' : '#fff3e0') : 'var(--white)',
                    borderColor: paymentStatus === s ? (s === 'PAID' ? 'rgba(26,122,74,0.3)' : 'rgba(192,92,0,0.3)') : 'var(--gray-100)',
                    color: paymentStatus === s ? (s === 'PAID' ? 'var(--green)' : 'var(--orange)') : 'var(--gray-400)',
                  }}>
                  {s === 'PAID' ? '✓ Payé' : '⏱ En attente'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['DIRECT', 'WHATSAPP', 'WEBSITE'] as const).map((m) => (
                <button type="button" key={m} onClick={() => setPaymentMethod(m)}
                  className="flex-1 flex items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-[0.98]"
                  style={{
                    background: paymentMethod === m ? 'var(--navy)' : 'var(--white)',
                    borderColor: paymentMethod === m ? 'var(--navy)' : 'var(--gray-100)',
                    color: paymentMethod === m ? '#fff' : 'var(--gray-400)',
                  }}>
                  {m === 'DIRECT' ? 'Direct' : m === 'WHATSAPP' ? 'WhatsApp' : 'Site web'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)..." rows={2} className="input-field text-sm" style={{ resize: 'none' }} />

        {/* Ajouter button */}
        <button type="button" onClick={handleAjouter}
          disabled={cart.length === 0}
          className="w-full py-4 rounded-2xl font-extrabold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-2"
          style={{
            background: cart.length === 0 ? 'var(--gray-100)' : 'var(--blue)',
            color: cart.length === 0 ? 'var(--gray-400)' : '#fff',
            boxShadow: cart.length > 0 ? '0 4px 16px rgba(46,109,180,0.25)' : 'none',
          }}>
          <Plus size={18} />
          Ajouter à la liste
        </button>
      </div>

      {/* ── Section B: Pending list ── */}
      {pendingSales.length > 0 && (
        <div className="mx-4 mt-2 mb-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--gray-50)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--gray-400)' }}>
                Liste en attente ({pendingSales.length})
              </p>
              <span className="text-sm font-extrabold" style={{ color: 'var(--navy)' }}>
                {formatCFA(pendingTotal)}
              </span>
            </div>

            <div className="divide-y" style={{ borderColor: 'var(--gray-50)' }}>
              {pendingSales.map((sale, idx) => (
                <div key={sale._key} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(46,109,180,0.08)', color: 'var(--blue)' }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
                      {sale.clientName || sale.clientId
                        ? clients.find((c) => c.id === sale.clientId)?.name ?? sale.clientName ?? 'Client'
                        : 'Anonyme'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>
                      {sale.cart.map((i) => `${i.product.name} ×${i.quantity}kg`).join(', ')}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: sale.paymentStatus === 'PAID' ? 'rgba(26,122,74,0.1)' : '#fff3e0',
                          color: sale.paymentStatus === 'PAID' ? 'var(--green)' : 'var(--orange)',
                        }}>
                        {sale.paymentStatus === 'PAID' ? 'Payé' : 'En attente'}
                      </span>
                      <span className="text-xs font-bold" style={{ color: 'var(--navy)' }}>{formatCFA(sale.total)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => removePending(sale._key)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                    style={{ color: 'var(--gray-400)' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {/* Confirm button */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--gray-100)' }}>
              <button type="button" onClick={handleConfirm} disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-extrabold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{
                  background: 'var(--navy)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(10,22,40,0.2)',
                }}>
                {isSubmitting
                  ? <><Loader2 size={18} className="animate-spin" /> Enregistrement...</>
                  : <><Check size={18} /> Confirmer {pendingSales.length} vente{pendingSales.length > 1 ? 's' : ''} — {formatCFA(pendingTotal)}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type Role = 'ADMIN' | 'AGENT';
export type Category = 'POISSON' | 'CRUSTACE' | 'AUTRE';
export type PaymentStatus = 'PAID' | 'PENDING';
export type PaymentMethod = 'WHATSAPP' | 'WEBSITE' | 'DIRECT';
export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface DashboardKPIs {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  ordersToday: number;
  ordersWeek: number;
  ordersMonth: number;
  bestProduct: { name: string; quantity: number } | null;
  marginOverview: number;
  subscriptionRevenue: number;
  individualRevenue: number;
  pendingOrders: number;
}

export interface ChartDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface AgentStats {
  id: string;
  name: string;
  email: string;
  ordersToday: number;
  ordersWeek: number;
  ordersMonth: number;
  revenueMonth: number;
  salary: number;
}

export interface SaleWithDetails {
  id: string;
  date: Date;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes: string | null;
  agent: { id: string; name: string };
  client: { id: string; name: string; phone: string | null } | null;
  items: Array<{
    id: string;
    quantity: number;
    pricePerKg: number;
    subtotal: number;
    product: { id: string; name: string; category: Category; purchasePrice: number };
  }>;
  services: Array<{
    id: string;
    price: number;
    service: { id: string; name: string };
  }>;
}

export interface ProductWithMargin {
  id: string;
  name: string;
  category: Category;
  purchasePrice: number;
  sellingPrice: number;
  unit: string;
  stock: number | null;
  active: boolean;
  photoUrl: string | null;
  margin: number;
}

export interface ClientWithStats {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  totalOrders: number;
  totalSpent: number;
}

export interface PendingSale {
  id: string;
  timestamp: number;
  productId: string;
  productName: string;
  quantity: number;
  pricePerKg: number;
  services: string[];
  clientName?: string;
  clientPhone?: string;
  paymentStatus: 'PAID' | 'PENDING';
  paymentMethod: 'WHATSAPP' | 'WEBSITE' | 'DIRECT';
  notes?: string;
  totalAmount: number;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
  }
}

export interface PaymentCacheEntry {
  provider?: 'stripe' | 'iyzico';
  sessionId?: string;
  sessionUrl?: string;
  status?: 'creating' | 'pending' | 'succeeded';
  lastEventId?: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
  tenantId?: string;
}

export interface PaymentSuccessPayload {
  bookingId: string;
  reference: string;
  amount: number;
  currency: string;
  txnId: string;
  tenantId?: string;
}

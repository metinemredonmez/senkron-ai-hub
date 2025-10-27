import { ApprovalTask, BookingSummary, CaseSummary, ChatMessage, QuoteSummary } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const TENANT = typeof window === 'undefined' ? 'demo-tenant' : localStorage.getItem('tenant') ?? 'demo-tenant';

async function apiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'X-Tenant': TENANT,
      },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Request failed');
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`Falling back for ${path}`, error);
    return fallback;
  }
}

export async function fetchCases(): Promise<CaseSummary[]> {
  return apiGet('/cases', [
    {
      id: 'case-001',
      patientName: 'Ayşe Yılmaz',
      targetProcedure: 'Bariatric Surgery',
      status: 'quote-ready',
      stage: 'pricing',
      redFlags: [],
      updatedAt: new Date().toISOString(),
      disclaimer: 'Non-diagnostic educational summary.',
    },
    {
      id: 'case-002',
      patientName: 'John Doe',
      targetProcedure: 'Dental Implants',
      status: 'awaiting-approval',
      stage: 'awaiting-approval',
      redFlags: ['clinical_review_required'],
      updatedAt: new Date().toISOString(),
      disclaimer: 'Pending human clinical validation.',
    },
  ]);
}

export async function fetchQuotes(): Promise<QuoteSummary[]> {
  return apiGet('/pricing', [
    {
      caseId: 'case-001',
      currency: 'EUR',
      total: 7400,
      travel: 900,
      disclaimer: 'Pricing indicative, excludes complications.',
    },
  ]);
}

export async function fetchBookings(): Promise<BookingSummary[]> {
  return apiGet('/bookings', [
    {
      id: 'booking-001',
      caseId: 'case-001',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      travelDate: new Date().toISOString(),
    },
  ]);
}

export async function fetchApprovals(): Promise<ApprovalTask[]> {
  return apiGet('/cases/approvals', [
    {
      id: 'approval-case-002',
      caseId: 'case-002',
      type: 'clinical_review',
      flags: ['BMI over 32'],
      status: 'PENDING',
    },
  ]);
}

export async function approveTask(taskId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/cases/${taskId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': TENANT,
      },
      body: JSON.stringify({ decision: 'APPROVED' }),
    });
  } catch (error) {
    console.error('Failed to approve task', error);
  }
}

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  return [
    {
      role: 'assistant',
      content: 'Merhaba! How can I support your medical travel planning today?',
    },
  ];
}

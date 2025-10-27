export type CaseStatus = 'intake' | 'eligibility' | 'quote-ready' | 'awaiting-approval' | 'booked';

export interface CaseSummary {
  id: string;
  patientName: string;
  targetProcedure: string;
  status: CaseStatus;
  stage: string;
  redFlags: string[];
  updatedAt: string;
  disclaimer: string;
}

export interface QuoteSummary {
  caseId: string;
  currency: string;
  total: number;
  travel?: number;
  disclaimer: string;
}

export interface BookingSummary {
  id: string;
  caseId: string;
  status: string;
  paymentStatus: string;
  travelDate: string;
}

export interface ApprovalTask {
  id: string;
  caseId: string;
  type: string;
  flags: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface ChatCitation {
  id: string;
  snippet: string;
  source: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
}

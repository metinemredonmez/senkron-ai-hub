export interface OrchestrationPricing {
  currency: string;
  total: number;
  travel?: number;
  breakdown: Record<string, any>;
  disclaimer: string;
}

export interface OrchestrationTravelPlan {
  flights: Record<string, any>;
  accommodations: Record<string, any>;
  transfers: Record<string, any>;
  itinerary: Record<string, any>;
}

export interface OrchestrationApproval {
  id: string;
  type: string;
  payload: Record<string, any>;
}

export interface OrchestrationEligibility {
  status: string;
  notes: string[];
  redFlags: string[];
}

export interface CaseOrchestrationResponse {
  caseId: string;
  status: string;
  stage: string;
  currentNode: string;
  clinicalSummary: string;
  disclaimers: string[];
  eligibility: OrchestrationEligibility;
  pricing: OrchestrationPricing;
  travelPlan: OrchestrationTravelPlan;
  approvals: OrchestrationApproval[];
  raw: Record<string, any>;
}

export interface CaseOrchestrationPayload {
  caseId: string;
  tenantId: string;
  patient: Record<string, any>;
  intake: Record<string, any>;
}

export interface PricingPayload {
  caseId: string;
  tenantId: string;
  adjustments: Record<string, any>;
}

export interface TravelPayload {
  caseId: string;
  tenantId: string;
  preferences: Record<string, any>;
}

export interface ApprovalPayload {
  caseId: string;
  tenantId: string;
  taskId: string;
  decision: 'APPROVED' | 'REJECTED';
  comment?: string;
}

export interface PricingResponse extends OrchestrationPricing {}

export interface TravelResponse extends OrchestrationTravelPlan {}

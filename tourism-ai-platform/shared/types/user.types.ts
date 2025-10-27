export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  country?: string;
  role: "admin" | "clinician" | "operator" | "patient";
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}
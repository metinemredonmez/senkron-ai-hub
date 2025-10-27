export interface Booking {
  id: string;
  patientId: string;
  packageId: string;
  providerId: string;
  totalPrice: number;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
}

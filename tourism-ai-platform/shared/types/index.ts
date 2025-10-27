/**
 * Health Tourism AI Platform - Shared Types Index
 * Central export hub for all cross-service TypeScript interfaces
 */

export * from "./api.types";
export * from "./booking.types";
export * from "./user.types";

/**
 * Eğer ileride yeni tipler eklersen (örneğin `provider.types.ts` veya `case.types.ts`),
 * sadece bu dosyaya aşağıdaki gibi bir satır eklemen yeterli olur:
 * 
 * export * from "./provider.types";
 */
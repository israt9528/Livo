import type { Prisma, SleepSchedule } from "../../../generated/prisma/client";

export interface PreferenceRecord {
  id: string;
  userId: string;
  budgetMin: Prisma.Decimal;
  budgetMax: Prisma.Decimal;
  cleanlinessLevel: number;
  sleepSchedule: SleepSchedule;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  preferredLocations: string[];
}

export interface MatchResult {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    phoneNumber: string | null;
  };
  compatibilityScore: number;
  breakdown: {
    cleanlinessMatch: number;
    sleepScheduleMatch: number;
    budgetOverlap: number;
    petCompatibility: number;
    locationOverlap: string[];
  };
  preference: {
    budgetMin: number;
    budgetMax: number;
    cleanlinessLevel: number;
    sleepSchedule: SleepSchedule;
    smokingAllowed: boolean;
    petsAllowed: boolean;
    preferredLocations: string[];
  };
}

import httpStatus from "http-status";
import {
	Prisma,
	SleepSchedule,
	UserRole,
	UserStatus,
} from "../../../generated/prisma/client";
import { AppError } from "../../utils/AppError.js";
import type {
	UpsertPreferenceInput,
	RoommateMatchQueryInput,
} from "./roommate.validation.js";
import { prisma } from "../../lib/prisma";
import type { MatchResult, PreferenceRecord } from "./roommate.interface";

/**
 * [✨ UNIQUE IMPLEMENTATION / VALUE-ADD]
 * Mathematical weighted vector compatibility scoring engine
 */
const calculateCompatibility = (
	userPref: PreferenceRecord,
	candidatePref: PreferenceRecord,
): { score: number; breakdown: MatchResult["breakdown"] } | null => {
	// 1. HARD VETO: Smoking mismatch is a non-negotiable incompatibility
	if (userPref.smokingAllowed !== candidatePref.smokingAllowed) {
		return null;
	}

	// 2. Cleanliness score (25% weight): Scale 1 to 5
	const cleanlinessDiff = Math.abs(
		userPref.cleanlinessLevel - candidatePref.cleanlinessLevel,
	);
	const cleanlinessScore = Math.max(0, 1 - cleanlinessDiff / 4);

	// 3. Sleep schedule alignment (25% weight)
	let sleepScore = 0.2;
	if (userPref.sleepSchedule === candidatePref.sleepSchedule) {
		sleepScore = 1.0;
	} else if (
		userPref.sleepSchedule === SleepSchedule.FLEXIBLE ||
		candidatePref.sleepSchedule === SleepSchedule.FLEXIBLE
	) {
		sleepScore = 0.75;
	} else {
		sleepScore = 0.0; // Early bird vs Night owl
	}

	// 4. Pet compatibility (20% weight)
	const petScore =
		userPref.petsAllowed === candidatePref.petsAllowed ? 1.0 : 0.0;

	// 5. Budget overlap calculation (20% weight)
	const uMin = Number(userPref.budgetMin);
	const uMax = Number(userPref.budgetMax);
	const cMin = Number(candidatePref.budgetMin);
	const cMax = Number(candidatePref.budgetMax);

	const overlapStart = Math.max(uMin, cMin);
	const overlapEnd = Math.min(uMax, cMax);
	let budgetScore = 0.0;

	if (overlapEnd >= overlapStart) {
		const overlapRange = overlapEnd - overlapStart;
		const userRange = Math.max(1, uMax - uMin);
		budgetScore = Math.min(1.0, overlapRange / userRange);
	}

	// 6. Location Synergy (10% weight)
	const userLocs = userPref.preferredLocations.map((l) => l.toLowerCase());
	const candidateLocs = candidatePref.preferredLocations.map((l) =>
		l.toLowerCase(),
	);
	const sharedLocations = userLocs.filter((loc) => candidateLocs.includes(loc));
	const locationScore = sharedLocations.length > 0 ? 1.0 : 0.2;

	// Compute final weighted composite score (0 - 100%)
	const compositeScore =
		cleanlinessScore * 25 +
		sleepScore * 25 +
		petScore * 20 +
		budgetScore * 20 +
		locationScore * 10;

	const roundedScore = Math.round(compositeScore);

	return {
		score: roundedScore,
		breakdown: {
			cleanlinessMatch: Math.round(cleanlinessScore * 100),
			sleepScheduleMatch: Math.round(sleepScore * 100),
			budgetOverlap: Math.round(budgetScore * 100),
			petCompatibility: Math.round(petScore * 100),
			locationOverlap: sharedLocations,
		},
	};
};

const upsertPreference = async (
	userId: string,
	payload: UpsertPreferenceInput,
) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, role: true, status: true, deletedAt: true },
	});

	if (!user || user.deletedAt !== null) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User not found or account is deactivated.",
		);
	}

	if (user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Cannot update preferences: Account is ${user.status.toLowerCase()}.`,
		);
	}

	const preference = await prisma.roommatePreference.upsert({
		where: { userId },
		create: {
			userId,
			budgetMin: payload.budgetMin,
			budgetMax: payload.budgetMax,
			cleanlinessLevel: payload.cleanlinessLevel,
			sleepSchedule: payload.sleepSchedule,
			smokingAllowed: payload.smokingAllowed,
			petsAllowed: payload.petsAllowed,
			preferredLocations: payload.preferredLocations,
		},
		update: {
			budgetMin: payload.budgetMin,
			budgetMax: payload.budgetMax,
			cleanlinessLevel: payload.cleanlinessLevel,
			sleepSchedule: payload.sleepSchedule,
			smokingAllowed: payload.smokingAllowed,
			petsAllowed: payload.petsAllowed,
			preferredLocations: payload.preferredLocations,
		},
	});

	return preference;
};

const findMatches = async (userId: string, query: RoommateMatchQueryInput) => {
	const currentPreference = await prisma.roommatePreference.findUnique({
		where: { userId },
	});

	if (!currentPreference) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"You must set your roommate preferences first before searching for matches.",
		);
	}

	// Fetch all active, non-deleted tenants who have filled out preferences (excluding self)
	const candidateUsers = await prisma.user.findMany({
		where: {
			id: { not: userId },
			role: UserRole.TENANT,
			status: UserStatus.ACTIVE,
			deletedAt: null,
			preference: { isNot: null },
		},
		select: {
			id: true,
			name: true,
			avatarUrl: true,
			bio: true,
			phoneNumber: true,
			preference: true,
		},
	});

	const matches: MatchResult[] = [];

	for (const candidate of candidateUsers) {
		if (!candidate.preference) continue;

		const evaluation = calculateCompatibility(
			currentPreference,
			candidate.preference,
		);

		// Skip vetoed matches or those below the requested minimum threshold
		if (!evaluation || evaluation.score < query.minScore) {
			continue;
		}

		matches.push({
			user: {
				id: candidate.id,
				name: candidate.name,
				avatarUrl: candidate.avatarUrl,
				bio: candidate.bio,
				phoneNumber: candidate.phoneNumber,
			},
			compatibilityScore: evaluation.score,
			breakdown: evaluation.breakdown,
			preference: {
				budgetMin: Number(candidate.preference.budgetMin),
				budgetMax: Number(candidate.preference.budgetMax),
				cleanlinessLevel: candidate.preference.cleanlinessLevel,
				sleepSchedule: candidate.preference.sleepSchedule,
				smokingAllowed: candidate.preference.smokingAllowed,
				petsAllowed: candidate.preference.petsAllowed,
				preferredLocations: candidate.preference.preferredLocations,
			},
		});
	}

	// Rank candidate matches from highest compatibility score to lowest
	matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

	// In-memory pagination of scored results
	const totalCount = matches.length;
	const page = query.page;
	const limit = query.limit;
	const totalPages = Math.ceil(totalCount / limit);
	const startIndex = (page - 1) * limit;
	const paginatedMatches = matches.slice(startIndex, startIndex + limit);

	return {
		meta: {
			total: totalCount,
			page,
			limit,
			totalPages,
		},
		matches: paginatedMatches,
	};
};

export const RoommateService = {
	upsertPreference,
	findMatches,
};

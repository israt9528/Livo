export interface SearchFilterConfig<T> {
	searchTerm?: string;
	searchableFields: (keyof T | string)[];
	filters?: Record<string, unknown>;
}

/**
 * Builds a dynamic Prisma WHERE clause combining keyword search across multiple fields
 * and exact-match attribute filters.
 */
const buildWhereClause = <T>(config: SearchFilterConfig<T>) => {
	const andConditions: Record<string, unknown>[] = [];

	// 1. Multi-Field Keyword Search (Case-insensitive ILIKE)
	if (config.searchTerm && config.searchTerm.trim() !== "") {
		const term = config.searchTerm.trim();
		const orConditions = config.searchableFields.map((field) => {
			// Support nested dot-notation fields (e.g., "owner.name")
			if (typeof field === "string" && field.includes(".")) {
				const parts = field.split(".");
				if (parts.length === 2 && parts[0] && parts[1]) {
					return {
						[parts[0]]: {
							[parts[1]]: {
								contains: term,
								mode: "insensitive",
							},
						},
					};
				}
			}

			return {
				[field]: {
					contains: term,
					mode: "insensitive",
				},
			};
		});

		andConditions.push({ OR: orConditions });
	}

	// 2. Exact Filters (e.g., city, propertyType, status)
	if (config.filters) {
		const filterEntries = Object.entries(config.filters).filter(
			([, value]) => value !== undefined && value !== null && value !== "",
		);

		if (filterEntries.length > 0) {
			const filterConditions = Object.fromEntries(filterEntries);
			andConditions.push(filterConditions);
		}
	}

	return andConditions.length > 0 ? { AND: andConditions } : {};
};

export const SearchUtils = {
	buildWhereClause,
};

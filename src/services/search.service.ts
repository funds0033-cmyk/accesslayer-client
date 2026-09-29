import { BaseApiService, type APIResponse } from './api.service';
import { cacheManager } from '@/utils/cache.utils';
import type { StellarNetwork } from '@/constants/stellar';

export interface SearchKeyItem {
	id: string;
	title: string;
	price?: number;
	priceStroops?: number;
	thumbnail?: string;
	creatorId?: string;
	category?: string;
	change24h?: number;
	symbol?: string;
	volume24h?: number;
}

export interface SearchCreatorItem {
	id: string;
	name?: string;
	title?: string;
	socialHandle?: string;
	avatarUri?: string;
	thumbnail?: string;
	bio?: string;
	isVerified?: boolean;
	category?: string;
}

export interface SearchTransactionItem {
	id: string;
	/** Full transaction hash. */
	hash: string;
	/** Stellar network the transaction belongs to (defaults to mainnet). */
	network?: StellarNetwork;
	/** Optional pre-built explorer URL from the backend. */
	explorerUrl?: string;
	status?: 'completed' | 'pending' | 'failed';
	timestamp?: number;
	/** Optional human-readable label, e.g. the key/creator the tx touched. */
	label?: string;
}

export interface GlobalSearchResults {
	keys: SearchKeyItem[];
	creators: SearchCreatorItem[];
	transactions: SearchTransactionItem[];
}

export const EMPTY_SEARCH_RESULTS: GlobalSearchResults = {
	keys: [],
	creators: [],
	transactions: [],
};

const SEARCH_CACHE_TTL = 15_000; // 15 seconds

/**
 * Normalizes a raw API payload into `GlobalSearchResults`, tolerating both
 * `{ keys, creators, transactions }` and `{ results: { ... } }` wrappers and
 * coercing missing/non-array groups to empty arrays.
 */
export function normalizeSearchResults(raw: unknown): GlobalSearchResults {
	if (!raw || typeof raw !== 'object') return EMPTY_SEARCH_RESULTS;

	const candidate =
		'results' in raw && raw.results && typeof raw.results === 'object'
			? raw.results
			: raw;
	const record = candidate as Record<string, unknown>;

	return {
		keys: Array.isArray(record.keys) ? (record.keys as SearchKeyItem[]) : [],
		creators: Array.isArray(record.creators)
			? (record.creators as SearchCreatorItem[])
			: [],
		transactions: Array.isArray(record.transactions)
			? (record.transactions as SearchTransactionItem[])
			: [],
	};
}

class SearchService extends BaseApiService {
	/**
	 * Search across creator keys, creator profiles, and transaction hashes.
	 * GET /search?q=:query
	 */
	async search(query: string): Promise<GlobalSearchResults> {
		const trimmed = query.trim();
		if (!trimmed) {
			return EMPTY_SEARCH_RESULTS;
		}

		const cacheKey = `global_search_${trimmed.toLowerCase()}`;
		const cached = cacheManager.get<GlobalSearchResults>(cacheKey);
		if (cached) return cached;

		try {
			const response = await this.api.get<APIResponse<unknown>>('/search', {
				params: { q: trimmed },
			});

			const result = normalizeSearchResults(response.data?.data);

			cacheManager.set(cacheKey, result, SEARCH_CACHE_TTL);
			return result;
		} catch (error) {
			throw this.handleError(error);
		}
	}
}

export const searchService = new SearchService();

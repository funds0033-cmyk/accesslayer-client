import { describe, it, expect } from 'vitest';
import {
	normalizeSearchResults,
	EMPTY_SEARCH_RESULTS,
} from '../search.service';

describe('normalizeSearchResults', () => {
	it('returns empty results for null/undefined/non-object payloads', () => {
		expect(normalizeSearchResults(null)).toEqual(EMPTY_SEARCH_RESULTS);
		expect(normalizeSearchResults(undefined)).toEqual(EMPTY_SEARCH_RESULTS);
		expect(normalizeSearchResults('nope')).toEqual(EMPTY_SEARCH_RESULTS);
		expect(normalizeSearchResults(42)).toEqual(EMPTY_SEARCH_RESULTS);
	});

	it('passes through a direct { keys, creators, transactions } payload', () => {
		const payload = {
			keys: [{ id: 'k1', title: 'Alpha Key' }],
			creators: [{ id: 'c1', name: 'Alice' }],
			transactions: [{ id: 't1', hash: 'abc' }],
		};
		expect(normalizeSearchResults(payload)).toEqual(payload);
	});

	it('unwraps a nested { results: {...} } payload', () => {
		const payload = {
			results: {
				keys: [{ id: 'k1', title: 'Alpha Key' }],
				creators: [],
				transactions: [{ id: 't1', hash: 'abc' }],
			},
		};
		const normalized = normalizeSearchResults(payload);
		expect(normalized.keys).toHaveLength(1);
		expect(normalized.creators).toHaveLength(0);
		expect(normalized.transactions).toHaveLength(1);
	});

	it('coerces missing or non-array groups to empty arrays', () => {
		const normalized = normalizeSearchResults({
			keys: 'not-an-array',
			creators: undefined,
		});
		expect(normalized).toEqual(EMPTY_SEARCH_RESULTS);
	});
});

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import GlobalSearch from '../GlobalSearch';
import {
	searchService,
	type GlobalSearchResults,
} from '@/services/search.service';
import { BrowserRouter } from 'react-router';
import { truncateTxHash } from '@/constants/stellar';

const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
	const actual = await vi.importActual('react-router');
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock('@/services/search.service', () => ({
	searchService: {
		search: vi.fn(),
	},
	EMPTY_SEARCH_RESULTS: { keys: [], creators: [], transactions: [] },
}));

describe('GlobalSearch (#1053)', () => {
	const TX_HASH =
		'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

	const mockResults: GlobalSearchResults = {
		keys: [
			{ id: 'key-1', title: 'Alpha Key', creatorId: 'creator-alpha' },
			{ id: 'key-2', title: 'Beta Key', creatorId: 'creator-beta' },
			{ id: 'key-3', title: 'Gamma Key', creatorId: 'creator-gamma' },
			{ id: 'key-4', title: 'Delta Key', creatorId: 'creator-delta' },
		],
		creators: [
			{ id: 'creator-1', name: 'Alice Creator', socialHandle: 'alice' },
		],
		transactions: [
			{
				id: 'tx-1',
				hash: TX_HASH,
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function renderSearch() {
		return render(
			<BrowserRouter>
				<GlobalSearch />
			</BrowserRouter>
		);
	}

	it('Cmd+K opens search input and focuses it', () => {
		renderSearch();

		const input = screen.getByTestId('global-search-input');
		expect(document.activeElement).not.toBe(input);

		fireEvent.keyDown(window, { key: 'k', metaKey: true });
		expect(document.activeElement).toBe(input);

		input.blur();

		fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
		expect(document.activeElement).toBe(input);
	});

	it('debounces API calls at 300ms while typing', async () => {
		vi.mocked(searchService.search).mockResolvedValue(mockResults);
		renderSearch();

		const input = screen.getByTestId('global-search-input');
		fireEvent.change(input, { target: { value: 'alp' } });

		expect(searchService.search).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(200);
		});
		expect(searchService.search).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(100);
		});

		expect(searchService.search).toHaveBeenCalledTimes(1);
		expect(searchService.search).toHaveBeenCalledWith('alp');
	});

	it('groups results into keys, creators, and transactions sections', async () => {
		vi.mocked(searchService.search).mockResolvedValue(mockResults);
		renderSearch();

		const input = screen.getByTestId('global-search-input');
		fireEvent.change(input, { target: { value: 'alpha' } });

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		await waitFor(() => {
			expect(screen.getByTestId('global-search-dropdown')).toBeInTheDocument();
		});

		expect(screen.getByTestId('global-search-group-keys')).toBeInTheDocument();
		expect(
			screen.getByTestId('global-search-group-creators')
		).toBeInTheDocument();
		expect(
			screen.getByTestId('global-search-group-transactions')
		).toBeInTheDocument();

		expect(screen.getAllByTestId('global-search-item-key')[0]).toHaveTextContent(
			'Alpha Key'
		);
		expect(screen.getByTestId('global-search-item-creator')).toHaveTextContent(
			'Alice Creator'
		);
		expect(
			screen.getByTestId('global-search-item-transaction')
		).toHaveTextContent(truncateTxHash(TX_HASH));
	});

	it('caps dropdown at top 3 keys and shows a view-all link for the rest', async () => {
		vi.mocked(searchService.search).mockResolvedValue(mockResults);
		renderSearch();

		const input = screen.getByTestId('global-search-input');
		fireEvent.change(input, { target: { value: 'key' } });

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		await waitFor(() => {
			expect(screen.getByTestId('global-search-dropdown')).toBeInTheDocument();
		});

		const keyItems = screen.getAllByTestId('global-search-item-key');
		expect(keyItems).toHaveLength(3);
		expect(
			keyItems.some(item => item.textContent?.includes('Delta Key'))
		).toBe(false);

		const viewAll = screen.getByTestId('global-search-view-all-keys');
		expect(viewAll).toBeInTheDocument();

		fireEvent.click(viewAll);
		expect(mockNavigate).toHaveBeenCalledWith(
			`/search?q=${encodeURIComponent('key')}`
		);
	});

	it('shows empty state when no results match the query', async () => {
		vi.mocked(searchService.search).mockResolvedValue({
			keys: [],
			creators: [],
			transactions: [],
		});
		renderSearch();

		const input = screen.getByTestId('global-search-input');
		fireEvent.change(input, { target: { value: 'xyzunknown' } });

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		await waitFor(() => {
			expect(screen.getByTestId('global-search-empty')).toBeInTheDocument();
		});

		expect(screen.getByText('No results found')).toBeInTheDocument();
	});
});

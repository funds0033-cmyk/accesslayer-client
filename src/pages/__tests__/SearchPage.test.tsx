import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router';
import SearchPage from '../SearchPage';
import {
	searchService,
	type GlobalSearchResults,
} from '@/services/search.service';

vi.mock('@/services/search.service', () => ({
	searchService: {
		search: vi.fn(),
	},
	EMPTY_SEARCH_RESULTS: { keys: [], creators: [], transactions: [] },
}));

function renderPage(initialUrl = '/search') {
	return render(
		<MemoryRouter initialEntries={[initialUrl]}>
			<Routes>
				<Route path="/search" element={<SearchPage />} />
			</Routes>
		</MemoryRouter>
	);
}

describe('SearchPage (#1053)', () => {
	const mockResults: GlobalSearchResults = {
		keys: [{ id: 'key-1', title: 'Alpha Key', creatorId: 'creator-alpha' }],
		creators: [{ id: 'creator-1', name: 'Alice Creator' }],
		transactions: [
			{
				id: 'tx-1',
				hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
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

	it('shows the initial prompt when no query is set', () => {
		renderPage();
		expect(screen.getByTestId('search-page')).toBeInTheDocument();
		expect(screen.getByTestId('search-page-initial')).toBeInTheDocument();
		expect(searchService.search).not.toHaveBeenCalled();
	});

	it('renders all three groups for a query', async () => {
		vi.mocked(searchService.search).mockResolvedValue(mockResults);
		renderPage('/search?q=alpha');

		const input = screen.getByTestId('search-page-input');
		fireEvent.change(input, { target: { value: 'alpha' } });

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		await waitFor(() => {
			expect(screen.getByTestId('search-page-group-keys')).toBeInTheDocument();
		});

		expect(
			screen.getByTestId('search-page-group-creators')
		).toBeInTheDocument();
		expect(
			screen.getByTestId('search-page-group-transactions')
		).toBeInTheDocument();
		expect(screen.getByTestId('search-page-item-key')).toHaveTextContent(
			'Alpha Key'
		);
		expect(screen.getByTestId('search-page-item-creator')).toHaveTextContent(
			'Alice Creator'
		);
		expect(
			screen.getByTestId('search-page-item-transaction')
		).toHaveTextContent('a1b2c3d4');
	});

	it('type filter hides other groups', async () => {
		vi.mocked(searchService.search).mockResolvedValue(mockResults);
		renderPage('/search?q=alpha');

		const input = screen.getByTestId('search-page-input');
		fireEvent.change(input, { target: { value: 'alpha' } });

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		await waitFor(() => {
			expect(screen.getByTestId('search-page-group-keys')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId('search-page-filter-creators'));

		await waitFor(() => {
			expect(
				screen.queryByTestId('search-page-group-keys')
			).not.toBeInTheDocument();
		});
		expect(
			screen.getByTestId('search-page-group-creators')
		).toBeInTheDocument();
		expect(
			screen.queryByTestId('search-page-group-transactions')
		).not.toBeInTheDocument();
	});

	it('shows empty state when no results match', async () => {
		vi.mocked(searchService.search).mockResolvedValue({
			keys: [],
			creators: [],
			transactions: [],
		});
		renderPage('/search?q=xyzunknown');

		const input = screen.getByTestId('search-page-input');
		fireEvent.change(input, { target: { value: 'xyzunknown' } });

		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		await waitFor(() => {
			expect(screen.getByTestId('search-page-empty')).toBeInTheDocument();
		});
		expect(screen.getByText('No results found')).toBeInTheDocument();
	});
});

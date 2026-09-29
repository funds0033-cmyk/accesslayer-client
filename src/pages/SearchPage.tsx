import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, Key, User, ReceiptText, Loader2, X } from 'lucide-react';
import {
	searchService,
	EMPTY_SEARCH_RESULTS,
	type GlobalSearchResults,
	type SearchKeyItem,
	type SearchCreatorItem,
	type SearchTransactionItem,
} from '@/services/search.service';
import { useDebounce } from '@/hooks/useDebounce';
import { highlightMatchingSubstring } from '@/utils/substringHighlight.utils';
import {
	buildStellarExpertTxUrl,
	truncateTxHash,
} from '@/constants/stellar';
import {
	formatDisplayKeyPrice,
	resolveCreatorKeyPriceStroops,
} from '@/utils/keyPriceDisplay.utils';

export type SearchTypeFilter = 'all' | 'keys' | 'creators' | 'transactions';

const TYPE_FILTERS: Array<{ value: SearchTypeFilter; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: 'keys', label: 'Keys' },
	{ value: 'creators', label: 'Creators' },
	{ value: 'transactions', label: 'Transactions' },
];

function normalizeTypeFilter(value: string | null): SearchTypeFilter {
	return TYPE_FILTERS.some(f => f.value === value)
		? (value as SearchTypeFilter)
		: 'all';
}

function KeyRow({ key_, query }: { key_: SearchKeyItem; query: string }) {
	const priceDisplay = formatDisplayKeyPrice(
		resolveCreatorKeyPriceStroops(key_)
	);
	return (
		<a
			href={`/creator/${encodeURIComponent(key_.creatorId || key_.id)}`}
			className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.07] transition-colors"
			data-testid="search-page-item-key"
		>
			<div className="size-8 rounded-md bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 text-amber-400">
				<Key className="size-4" />
			</div>
			<div className="flex-1 min-w-0">
				<div className="truncate text-sm font-medium text-white">
					{highlightMatchingSubstring(key_.title, query)}
				</div>
				{key_.category && (
					<div className="text-xs text-white/40 truncate">{key_.category}</div>
				)}
			</div>
			{priceDisplay !== '—' && (
				<span className="shrink-0 font-mono text-xs text-amber-300">
					{priceDisplay}
				</span>
			)}
		</a>
	);
}

function CreatorRow({
	creator,
	query,
}: {
	creator: SearchCreatorItem;
	query: string;
}) {
	const displayName = creator.name || creator.title || 'Creator';
	const imageUri = creator.avatarUri || creator.thumbnail;
	return (
		<a
			href={`/creator/${encodeURIComponent(creator.id)}`}
			className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.07] transition-colors"
			data-testid="search-page-item-creator"
		>
			{imageUri ? (
				<img
					src={imageUri}
					alt={displayName}
					className="size-8 rounded-full object-cover shrink-0 border border-white/10"
				/>
			) : (
				<div className="size-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
					<User className="size-4" />
				</div>
			)}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<span className="truncate text-sm font-medium text-white">
						{highlightMatchingSubstring(displayName, query)}
					</span>
					{creator.isVerified && (
						<span
							className="size-1.5 rounded-full bg-amber-400 shrink-0"
							title="Verified creator"
						/>
					)}
				</div>
				{creator.socialHandle && (
					<div className="text-xs font-mono text-white/40 truncate">
						@{highlightMatchingSubstring(creator.socialHandle, query)}
					</div>
				)}
			</div>
		</a>
	);
}

function TransactionRow({
	tx,
	query,
}: {
	tx: SearchTransactionItem;
	query: string;
}) {
	const url =
		tx.explorerUrl || buildStellarExpertTxUrl(tx.hash, tx.network ?? 'mainnet');
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.07] transition-colors"
			data-testid="search-page-item-transaction"
		>
			<div className="size-8 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
				<ReceiptText className="size-4" />
			</div>
			<div className="flex-1 min-w-0">
				<div className="truncate font-mono text-sm text-white">
					{highlightMatchingSubstring(truncateTxHash(tx.hash), query)}
				</div>
				{tx.label && (
					<div className="text-xs text-white/40 truncate">{tx.label}</div>
				)}
			</div>
			{tx.status && (
				<span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold capitalize text-white/60">
					{tx.status}
				</span>
			)}
		</a>
	);
}

function GroupSection({
	testId,
	icon,
	title,
	count,
	children,
}: {
	testId: string;
	icon: React.ReactNode;
	title: string;
	count: number;
	children: React.ReactNode;
}) {
	return (
		<section data-testid={testId} className="space-y-2">
			<div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-400/80">
				{icon}
				<span>{title}</span>
				<span className="text-white/40">({count})</span>
			</div>
			<div className="space-y-2">{children}</div>
		</section>
	);
}

function SearchPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const urlQuery = searchParams.get('q') ?? '';
	const typeFilter = normalizeTypeFilter(searchParams.get('type'));

	const [inputValue, setInputValue] = useState(urlQuery);
	const [results, setResults] =
		useState<GlobalSearchResults>(EMPTY_SEARCH_RESULTS);
	const [isLoading, setIsLoading] = useState(false);

	const debouncedQuery = useDebounce(inputValue, 300);

	// Keep the URL in sync with the debounced query (shareable /search?q=...).
	useEffect(() => {
		const trimmed = debouncedQuery.trim();
		if (trimmed === urlQuery.trim()) return;
		const next = new URLSearchParams(searchParams);
		if (trimmed) {
			next.set('q', trimmed);
		} else {
			next.delete('q');
		}
		setSearchParams(next, { replace: true });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedQuery]);

	// Fetch results whenever the query or type filter changes.
	useEffect(() => {
		const trimmed = urlQuery.trim();
		if (!trimmed) {
			setResults(EMPTY_SEARCH_RESULTS);
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		setIsLoading(true);

		searchService
			.search(trimmed)
			.then(data => {
				if (!cancelled) {
					setResults({
						keys: Array.isArray(data?.keys) ? data.keys : [],
						creators: Array.isArray(data?.creators) ? data.creators : [],
						transactions: Array.isArray(data?.transactions)
							? data.transactions
							: [],
					});
					setIsLoading(false);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setResults(EMPTY_SEARCH_RESULTS);
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [urlQuery]);

	const query = urlQuery.trim();
	const hasQuery = query !== '';

	const showKeys =
		(typeFilter === 'all' || typeFilter === 'keys') && results.keys.length > 0;
	const showCreators =
		(typeFilter === 'all' || typeFilter === 'creators') &&
		results.creators.length > 0;
	const showTransactions =
		(typeFilter === 'all' || typeFilter === 'transactions') &&
		results.transactions.length > 0;

	const totalResultsCount =
		results.keys.length + results.creators.length + results.transactions.length;

	const handleTypeChange = (value: SearchTypeFilter) => {
		const next = new URLSearchParams(searchParams);
		if (value === 'all') {
			next.delete('type');
		} else {
			next.set('type', value);
		}
		setSearchParams(next, { replace: true });
	};

	const activeFilters = useMemo(
		() =>
			TYPE_FILTERS.filter(f => f.value !== 'all').map(f => ({
				...f,
				isActive: typeFilter === f.value,
			})),
		[typeFilter]
	);

	return (
		<main
			className="min-h-screen bg-[#06111f] text-white"
			data-testid="search-page"
		>
			<div className="mx-auto w-full max-w-3xl px-6 py-12">
				<h1 className="font-grotesque text-3xl font-black tracking-tight sm:text-4xl">
					Search
				</h1>
				<p className="mt-2 text-sm text-white/60">
					Find creator keys, creator profiles, and transactions.
				</p>

				{/* Search input */}
				<form
					className="relative mt-6"
					role="search"
					aria-label="Global search"
					onSubmit={e => e.preventDefault()}
				>
					<Search
						className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-white/40"
						aria-hidden="true"
					/>
					<input
						type="text"
						value={inputValue}
						onChange={e => setInputValue(e.target.value)}
						placeholder="Search keys, creators, transactions..."
						className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-10 text-sm text-white placeholder:text-white/40 focus:border-amber-500/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
						data-testid="search-page-input"
						aria-label="Search keys, creators, and transactions"
						autoFocus
					/>
					{isLoading && (
						<Loader2
							className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-amber-400"
							data-testid="search-page-spinner"
						/>
					)}
					{!isLoading && inputValue && (
						<button
							type="button"
							onClick={() => setInputValue('')}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
							aria-label="Clear search"
							data-testid="search-page-clear"
						>
							<X className="size-4" />
						</button>
					)}
				</form>

				{/* Type filter */}
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={() => handleTypeChange('all')}
						className={
							typeFilter === 'all'
								? 'rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950'
								: 'rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60 hover:text-white transition-colors'
						}
						data-testid="search-page-filter-all"
					>
						All
					</button>
					{activeFilters.map(filter => (
						<button
							key={filter.value}
							type="button"
							onClick={() => handleTypeChange(filter.value)}
							className={
								filter.isActive
									? 'rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950'
									: 'rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60 hover:text-white transition-colors'
							}
							data-testid={`search-page-filter-${filter.value}`}
						>
							{filter.label}
						</button>
					))}
				</div>

				{/* Results */}
				<div className="mt-8 space-y-8">
					{!hasQuery ? (
						<p
							className="py-12 text-center text-sm text-white/40"
							data-testid="search-page-initial"
						>
							Start typing to search across keys, creators, and transactions.
						</p>
					) : isLoading && totalResultsCount === 0 ? (
						<p
							className="py-12 text-center text-sm text-white/40"
							data-testid="search-page-loading"
							role="status"
						>
							Searching...
						</p>
					) : totalResultsCount === 0 ? (
						<div
							className="py-12 text-center"
							data-testid="search-page-empty"
						>
							<p className="font-medium text-white/70">No results found</p>
							<p className="mt-1 text-sm text-white/40">
								No keys, creators, or transactions matching &ldquo;{query}
								&rdquo;
							</p>
						</div>
					) : (
						<>
							{showKeys && (
								<GroupSection
									testId="search-page-group-keys"
									icon={<Key className="size-3.5" aria-hidden="true" />}
									title="Keys"
									count={results.keys.length}
								>
									{results.keys.map(key_ => (
										<KeyRow key={key_.id} key_={key_} query={query} />
									))}
								</GroupSection>
							)}
							{showCreators && (
								<GroupSection
									testId="search-page-group-creators"
									icon={<User className="size-3.5" aria-hidden="true" />}
									title="Creators"
									count={results.creators.length}
								>
									{results.creators.map(creator => (
										<CreatorRow
											key={creator.id}
											creator={creator}
											query={query}
										/>
									))}
								</GroupSection>
							)}
							{showTransactions && (
								<GroupSection
									testId="search-page-group-transactions"
									icon={
										<ReceiptText className="size-3.5" aria-hidden="true" />
									}
									title="Transactions"
									count={results.transactions.length}
								>
									{results.transactions.map(tx => (
										<TransactionRow key={tx.id} tx={tx} query={query} />
									))}
								</GroupSection>
							)}
						</>
					)}
				</div>
			</div>
		</main>
	);
}

export default SearchPage;

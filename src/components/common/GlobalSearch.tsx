import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2, Key, User, ArrowRight, ReceiptText, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDebounce } from '@/hooks/useDebounce';
import {
	searchService,
	EMPTY_SEARCH_RESULTS,
	type GlobalSearchResults,
	type SearchKeyItem,
	type SearchCreatorItem,
	type SearchTransactionItem,
} from '@/services/search.service';
import { highlightMatchingSubstring } from '@/utils/substringHighlight.utils';
import { cn } from '@/lib/utils';
import { Kbd } from '@/components/ui/kbd';
import {
	buildStellarExpertTxUrl,
	truncateTxHash,
} from '@/constants/stellar';

interface GlobalSearchProps {
	className?: string;
	placeholder?: string;
}

/** Top 3 results per group are shown in the dropdown (issue #1053). */
const SEARCH_DROPDOWN_GROUP_LIMIT = 3;

const GlobalSearch: React.FC<GlobalSearchProps> = ({
	className,
	placeholder = 'Search keys, creators, transactions...',
}) => {
	const [query, setQuery] = useState('');
	const [results, setResults] =
		useState<GlobalSearchResults>(EMPTY_SEARCH_RESULTS);
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();

	const debouncedQuery = useDebounce(query, 300);

	// Cmd+K / Ctrl+K keyboard shortcut to focus input
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
				e.preventDefault();
				inputRef.current?.focus();
				setIsOpen(true);
			}
		};

		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => {
			window.removeEventListener('keydown', handleGlobalKeyDown);
		};
	}, []);

	// Fetch search results on debounced query change (300ms)
	useEffect(() => {
		const trimmed = debouncedQuery.trim();
		if (!trimmed) {
			setResults(EMPTY_SEARCH_RESULTS);
			setIsLoading(false);
			setIsOpen(false);
			return;
		}

		let cancelled = false;
		setIsLoading(true);
		setIsOpen(true);

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
	}, [debouncedQuery]);

	// Handle click outside to close dropdown
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	// Handle Escape key to clear dropdown and reset input
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Escape') {
			setQuery('');
			setResults(EMPTY_SEARCH_RESULTS);
			setIsOpen(false);
			inputRef.current?.blur();
		}
	};

	const handleNavigate = useCallback(
		(path: string) => {
			setQuery('');
			setResults(EMPTY_SEARCH_RESULTS);
			setIsOpen(false);
			navigate(path);
		},
		[navigate]
	);

	const handleSelectKey = (key: SearchKeyItem) => {
		const creatorId = key.creatorId || key.id;
		handleNavigate(`/creator/${encodeURIComponent(creatorId)}`);
	};

	const handleSelectCreator = (creator: SearchCreatorItem) => {
		handleNavigate(`/creator/${encodeURIComponent(creator.id)}`);
	};

	const handleSelectTransaction = (tx: SearchTransactionItem) => {
		const url =
			tx.explorerUrl ||
			buildStellarExpertTxUrl(tx.hash, tx.network ?? 'mainnet');
		window.open(url, '_blank', 'noopener,noreferrer');
	};

	const handleClear = () => {
		setQuery('');
		setResults(EMPTY_SEARCH_RESULTS);
		setIsOpen(false);
		inputRef.current?.focus();
	};

	const totalResultsCount =
		results.keys.length + results.creators.length + results.transactions.length;
	const hasQuery = query.trim() !== '';

	// Cap each group at 3 items in the dropdown; the full list lives on /search.
	const visibleKeys = useMemo(
		() => results.keys.slice(0, SEARCH_DROPDOWN_GROUP_LIMIT),
		[results.keys]
	);
	const visibleCreators = useMemo(
		() => results.creators.slice(0, SEARCH_DROPDOWN_GROUP_LIMIT),
		[results.creators]
	);
	const visibleTransactions = useMemo(
		() => results.transactions.slice(0, SEARCH_DROPDOWN_GROUP_LIMIT),
		[results.transactions]
	);

	const viewAllHref = `/search?q=${encodeURIComponent(query.trim())}`;

	return (
		<div ref={containerRef} className={cn('relative w-full max-w-xs', className)}>
			<div className="relative flex items-center">
				<Search className="pointer-events-none absolute left-3 size-4 text-white/40" />
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={e => setQuery(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => {
						setIsFocused(true);
						if (query.trim()) {
							setIsOpen(true);
						}
					}}
					onBlur={() => setIsFocused(false)}
					placeholder={placeholder}
					className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-9 pr-14 text-xs text-white placeholder:text-white/40 focus:border-amber-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
					data-testid="global-search-input"
					aria-label="Global search keys, creators, and transactions"
					role="combobox"
					aria-expanded={isOpen}
					aria-haspopup="listbox"
					aria-autocomplete="list"
				/>

				<div className="absolute right-2 flex items-center gap-1.5 pointer-events-auto">
					{isLoading ? (
						<Loader2
							className="size-3.5 animate-spin text-amber-400"
							data-testid="global-search-spinner"
						/>
					) : query ? (
						<button
							type="button"
							onClick={handleClear}
							className="text-xs text-white/50 hover:text-white transition-colors"
							aria-label="Clear search query"
							data-testid="global-search-clear"
						>
							<X className="size-3.5" />
						</button>
					) : !isFocused ? (
						<Kbd
							data-testid="global-search-shortcut"
							className="hidden sm:inline-flex h-4 border border-white/15 bg-white/5 px-1 font-mono text-[9px] text-white/40"
						>
							⌘K
						</Kbd>
					) : null}
				</div>
			</div>

			{/* Dropdown list */}
			{isOpen && hasQuery && (
				<div
					className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-[#0d1b2a] p-2 shadow-2xl backdrop-blur-lg divide-y divide-white/5"
					data-testid="global-search-dropdown"
					role="listbox"
				>
					{/* Loading skeleton */}
					{isLoading ? (
						<div
							className="p-3 space-y-4"
							data-testid="global-search-loading"
							role="status"
							aria-label="Searching..."
						>
							<div className="space-y-2">
								<div className="h-2.5 w-14 rounded bg-white/10 animate-pulse" />
								<div className="flex items-center gap-2.5 rounded-lg p-2 bg-white/[0.03] animate-pulse">
									<div className="size-6 rounded-full bg-white/10" />
									<div className="flex-1 space-y-1.5">
										<div className="h-3 w-24 rounded bg-white/10" />
										<div className="h-2 w-16 rounded bg-white/10" />
									</div>
								</div>
								<div className="flex items-center gap-2.5 rounded-lg p-2 bg-white/[0.03] animate-pulse">
									<div className="size-6 rounded-full bg-white/10" />
									<div className="flex-1 space-y-1.5">
										<div className="h-3 w-28 rounded bg-white/10" />
										<div className="h-2 w-12 rounded bg-white/10" />
									</div>
								</div>
							</div>
							<div className="space-y-2 pt-2 border-t border-white/5">
								<div className="h-2.5 w-16 rounded bg-white/10 animate-pulse" />
								<div className="flex items-center gap-2.5 rounded-lg p-2 bg-white/[0.03] animate-pulse">
									<div className="size-6 rounded bg-white/10" />
									<div className="flex-1 space-y-1.5">
										<div className="h-3 w-32 rounded bg-white/10" />
										<div className="h-2 w-20 rounded bg-white/10" />
									</div>
								</div>
							</div>
						</div>
					) : totalResultsCount > 0 ? (
						<div className="space-y-3">
							{/* Keys group */}
							{visibleKeys.length > 0 && (
								<div data-testid="global-search-group-keys">
									<div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
										<Key className="size-3" aria-hidden="true" />
										<span>Keys</span>
										<span className="ml-auto text-[9px] text-white/40">
											{results.keys.length}
										</span>
									</div>
									<ul className="mt-1 space-y-0.5">
										{visibleKeys.map(key => (
											<li key={key.id}>
												<button
													type="button"
													onClick={() => handleSelectKey(key)}
													className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-white hover:bg-white/10 transition-colors"
													data-testid="global-search-item-key"
												>
													{key.thumbnail ? (
														<img
															src={key.thumbnail}
															alt={key.title}
															className="size-6 rounded-md object-cover shrink-0 border border-white/10"
														/>
													) : (
														<div className="size-6 rounded-md bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 text-amber-400">
															<Key className="size-3" />
														</div>
													)}
													<div className="flex-1 min-w-0">
														<div className="truncate font-medium text-white">
															{highlightMatchingSubstring(key.title, query)}
														</div>
														{key.category && (
															<div className="text-[10px] text-white/40 truncate">
																{key.category}
															</div>
														)}
													</div>
													<ArrowRight className="size-3 shrink-0 text-white/30" />
												</button>
											</li>
										))}
									</ul>
									{results.keys.length > SEARCH_DROPDOWN_GROUP_LIMIT && (
										<button
											type="button"
											onClick={() => handleNavigate(viewAllHref)}
											className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-amber-300/90 hover:bg-white/10 transition-colors"
											data-testid="global-search-view-all-keys"
										>
											View all {results.keys.length} keys →
										</button>
									)}
								</div>
							)}

							{/* Creators group */}
							{visibleCreators.length > 0 && (
								<div data-testid="global-search-group-creators" className="pt-2">
									<div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
										<User className="size-3" aria-hidden="true" />
										<span>Creators</span>
										<span className="ml-auto text-[9px] text-white/40">
											{results.creators.length}
										</span>
									</div>
									<ul className="mt-1 space-y-0.5">
										{visibleCreators.map(creator => {
											const displayName =
												creator.name || creator.title || 'Creator';
											const imageUri = creator.avatarUri || creator.thumbnail;
											return (
												<li key={creator.id}>
													<button
														type="button"
														onClick={() => handleSelectCreator(creator)}
														className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-white hover:bg-white/10 transition-colors"
														data-testid="global-search-item-creator"
													>
														{imageUri ? (
															<img
																src={imageUri}
																alt={displayName}
																className="size-6 rounded-full object-cover shrink-0 border border-white/10"
															/>
														) : (
															<div className="size-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
																<User className="size-3" />
															</div>
														)}
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-1.5">
																<span className="truncate font-medium text-white">
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
																<div className="text-[10px] text-white/40 truncate font-mono">
																	@{highlightMatchingSubstring(creator.socialHandle, query)}
																</div>
															)}
														</div>
														<ArrowRight className="size-3 shrink-0 text-white/30" />
													</button>
												</li>
											);
										})}
									</ul>
									{results.creators.length > SEARCH_DROPDOWN_GROUP_LIMIT && (
										<button
											type="button"
											onClick={() => handleNavigate(viewAllHref)}
											className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-amber-300/90 hover:bg-white/10 transition-colors"
											data-testid="global-search-view-all-creators"
										>
											View all {results.creators.length} creators →
										</button>
									)}
								</div>
							)}

							{/* Transactions group */}
							{visibleTransactions.length > 0 && (
								<div
									data-testid="global-search-group-transactions"
									className="pt-2"
								>
									<div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
										<ReceiptText className="size-3" aria-hidden="true" />
										<span>Transactions</span>
										<span className="ml-auto text-[9px] text-white/40">
											{results.transactions.length}
										</span>
									</div>
									<ul className="mt-1 space-y-0.5">
										{visibleTransactions.map(tx => (
											<li key={tx.id}>
												<button
													type="button"
													onClick={() => handleSelectTransaction(tx)}
													className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-white hover:bg-white/10 transition-colors"
													data-testid="global-search-item-transaction"
												>
													<div className="size-6 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
														<ReceiptText className="size-3" />
													</div>
													<div className="flex-1 min-w-0">
														<div className="truncate font-mono text-white">
															{highlightMatchingSubstring(
																truncateTxHash(tx.hash),
																query
															)}
														</div>
														{tx.label && (
															<div className="text-[10px] text-white/40 truncate">
																{tx.label}
															</div>
														)}
													</div>
													<ArrowRight className="size-3 shrink-0 text-white/30" />
												</button>
											</li>
										))}
									</ul>
									{results.transactions.length > SEARCH_DROPDOWN_GROUP_LIMIT && (
										<button
											type="button"
											onClick={() => handleNavigate(viewAllHref)}
											className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-amber-300/90 hover:bg-white/10 transition-colors"
											data-testid="global-search-view-all-transactions"
										>
											View all {results.transactions.length} transactions →
										</button>
									)}
								</div>
							)}
						</div>
					) : (
						<div
							className="p-6 text-center text-xs text-white/50"
							data-testid="global-search-empty"
						>
							<p className="font-medium text-white/70">No results found</p>
							<p className="mt-1 text-white/40">
								No keys, creators, or transactions matching &ldquo;
								{debouncedQuery}&rdquo;
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default GlobalSearch;

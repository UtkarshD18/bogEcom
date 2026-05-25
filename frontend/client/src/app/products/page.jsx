"use client";

import ProductItem from "@/components/ProductItem";
import {
    subscribeToStockConnection,
    subscribeToStockUpdates,
} from "@/realtime/stockSocket";
import { isProductOutOfStock } from "@/utils/productAvailability";
import { fetchDataFromApi } from "@/utils/api";
import { applyStockUpdateToProductCollection } from "@/utils/stockRealtime";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Suspense,
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    FiChevronDown,
    FiFilter,
    FiSearch,
    FiSliders,
    FiX,
} from "react-icons/fi";

const PRODUCTS_PER_PAGE = 24;
const FALLBACK_POLL_INTERVAL_MS = 45000;

const PRICE_FILTERS = [
    { label: "All prices", min: "", max: "" },
    { label: "Under ₹500", min: "", max: "500" },
    { label: "₹500 - ₹799", min: "500", max: "799" },
    { label: "₹800 and above", min: "800", max: "" },
];

const FLAVOR_FILTERS = [
    { label: "All flavours", value: "" },
    { label: "Classic", value: "classic" },
    { label: "Dark Chocolate", value: "dark chocolate" },
    { label: "Choco Millet", value: "choco millet" },
    { label: "Crunchy", value: "crunchy" },
    { label: "Creamy", value: "creamy" },
];

const PRODUCT_TYPE_FILTERS = [
    { label: "All items", value: "all" },
    { label: "Products only", value: "product" },
    { label: "Combos only", value: "combo" },
];

const SORT_OPTIONS = [
    { label: "Newest first", sortBy: "createdAt", order: "desc" },
    { label: "Newest combos", sortBy: "newestCombos", order: "desc", productType: "combo" },
    { label: "Most selling", sortBy: "soldCount", order: "desc" },
    { label: "Best sellers", sortBy: "bestSeller", order: "desc" },
    { label: "Price: Low to high", sortBy: "price", order: "asc" },
    { label: "Price: High to low", sortBy: "price", order: "desc" },
];

const ProductsGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-3/4 bg-gray-100 animate-pulse rounded-3xl" />
        ))}
    </div>
);

function ProductsPageContent() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState("");
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showSort, setShowSort] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const loaderRef = useRef(null);
    const fallbackPollRef = useRef(null);
    const latestLoadRequestRef = useRef(0);

    // Get search term from URL
    const urlSearchTerm = searchParams.get("search") || searchParams.get("q") || "";
    const urlCategory = searchParams.get("category") || "";
    const urlBestSeller = searchParams.get("bestSeller") === "true";
    const urlNewArrivals = searchParams.get("newArrivals") === "true";
    const urlPriceDrop = searchParams.get("priceDrop") === "true";
    const urlMinDiscount = searchParams.get("minDiscount") || "";
    const urlMinPrice = searchParams.get("minPrice") || "";
    const urlMaxPrice = searchParams.get("maxPrice") || "";
    const urlFlavor = searchParams.get("flavor") || "";
    const urlProductType = searchParams.get("productType") || "all";
    const urlSortBy = searchParams.get("sortBy") || "createdAt";
    const urlOrder = searchParams.get("order") || "desc";
    const [searchTerm, setSearchTerm] = useState(urlSearchTerm);
    const [activeSearchTerm, setActiveSearchTerm] = useState(urlSearchTerm);
    const lastAppliedUrlSearchRef = useRef(urlSearchTerm);
    const pendingUrlSearchRef = useRef(null);
    const isComboCategory = (category) => {
        const name = String(category?.name || "").toLowerCase();
        const slug = String(category?.slug || "").toLowerCase();
        const comboKeys = [
            "combo-packs",
            "combo-pack",
            "combo-deals",
            "combo-deal",
            "combos",
        ];
        return (
            comboKeys.includes(slug) ||
            name.includes("combo pack") ||
            name.includes("combo packs") ||
            name.includes("combo deal") ||
            name.includes("combo deals")
        );
    };

    useEffect(() => {
        if (!urlCategory) return;
        let isActive = true;
        const checkCategory = async () => {
            try {
                const response = await fetchDataFromApi("/api/categories");
                const list = response?.data || response?.categories || [];
                const match = list.find(
                    (category) =>
                        String(category?._id || category?.id || "") ===
                        String(urlCategory),
                );
                if (match && isComboCategory(match) && isActive) {
                    router.replace("/combo-deals");
                }
            } catch (error) {
                // Best effort redirect only
            }
        };
        checkCategory();
        return () => {
            isActive = false;
        };
    }, [urlCategory, router]);

    // Sync state with URL when URL changes (e.g. from header search).
    // Ignore URL writes started by this input so delayed route updates cannot
    // replace newer letters while the user is typing quickly.
    useEffect(() => {
        const normalizedUrlSearch = String(urlSearchTerm || "").trim();

        if (pendingUrlSearchRef.current === normalizedUrlSearch) {
            pendingUrlSearchRef.current = null;
            lastAppliedUrlSearchRef.current = normalizedUrlSearch;
            return;
        }

        if (lastAppliedUrlSearchRef.current === normalizedUrlSearch) return;

        lastAppliedUrlSearchRef.current = normalizedUrlSearch;
        setSearchTerm(normalizedUrlSearch);
        setActiveSearchTerm(normalizedUrlSearch);
    }, [urlSearchTerm]);

    // Keep results and URL search param in sync with input (debounced).
    useEffect(() => {
        const nextSearch = String(searchTerm || "").trim();

        const timeoutId = setTimeout(() => {
            setActiveSearchTerm((current) =>
                current === nextSearch ? current : nextSearch,
            );

            const currentSearch = String(urlSearchTerm || "").trim();
            if (currentSearch === nextSearch) return;

            const params = new URLSearchParams(searchParams.toString());
            if (nextSearch) params.set("search", nextSearch);
            else params.delete("search");
            const query = params.toString();
            pendingUrlSearchRef.current = nextSearch;
            startTransition(() => {
                router.replace(query ? `/products?${query}` : "/products", {
                    scroll: false,
                });
            });
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [searchTerm, searchParams, router, urlSearchTerm]);

    const buildQueryString = useCallback((
        targetPage = 1,
        limitOverride = PRODUCTS_PER_PAGE,
    ) => {
        const queryParams = new URLSearchParams();
        if (activeSearchTerm) queryParams.set("search", activeSearchTerm);
        if (urlCategory) queryParams.set("category", urlCategory);
        if (urlBestSeller) queryParams.set("bestSeller", "true");
        if (urlNewArrivals) queryParams.set("newArrivals", "true");
        if (urlPriceDrop) queryParams.set("priceDrop", "true");
        if (urlMinDiscount) queryParams.set("minDiscount", urlMinDiscount);
        if (urlMinPrice) queryParams.set("minPrice", urlMinPrice);
        if (urlMaxPrice) queryParams.set("maxPrice", urlMaxPrice);
        if (urlFlavor) queryParams.set("flavor", urlFlavor);
        if (urlProductType && urlProductType !== "all") {
            queryParams.set("productType", urlProductType);
        }
        queryParams.set("sortBy", urlSortBy);
        queryParams.set("order", urlOrder);
        queryParams.set("separateVariants", "true");
        queryParams.set("includeCombos", "true");
        queryParams.set("limit", String(limitOverride));
        queryParams.set("page", String(targetPage));
        return queryParams.toString();
    }, [
        activeSearchTerm,
        urlCategory,
        urlBestSeller,
        urlNewArrivals,
        urlPriceDrop,
        urlMinDiscount,
        urlMinPrice,
        urlMaxPrice,
        urlFlavor,
        urlProductType,
        urlSortBy,
        urlOrder,
    ]);

    const loadProducts = useCallback(async ({
        targetPage = 1,
        replace = true,
        limitOverride = PRODUCTS_PER_PAGE,
        showLoader = targetPage === 1,
        preserveCurrent = false,
        skipCache = false,
    } = {}) => {
        const requestId = latestLoadRequestRef.current + 1;
        latestLoadRequestRef.current = requestId;
        if (showLoader && targetPage === 1) setLoading(true);
        setFetchError("");
        try {
            const queryString = buildQueryString(targetPage, limitOverride);
            const query = queryString ? `?${queryString}` : "";
            const res = await fetchDataFromApi(`/api/products${query}`, {
                skipCache,
            });
            if (res?.error) {
                throw new Error(res?.message || "Failed to load products");
            }

            const productsData = Array.isArray(res) ? res : (res?.products || res?.data || res?.items || []);
            const normalized = productsData.filter((product) => product?.isExclusive !== true);

            if (requestId !== latestLoadRequestRef.current) return;

            setProducts((prev) => {
                const merged = replace ? normalized : [...prev, ...normalized];
                const seen = new Set();
                return merged.filter((product) => {
                    const id = String(product?._id || product?.id || product?.slug || "").trim();
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
            });

            const resolvedTotalProducts = Number(
                res?.totalProducts || normalized.length,
            );
            setTotalProducts(resolvedTotalProducts);
            setPages(
                Math.max(
                    Math.ceil(resolvedTotalProducts / PRODUCTS_PER_PAGE) || 1,
                    1,
                ),
            );
        } catch (error) {
            if (requestId !== latestLoadRequestRef.current) return;

            console.warn("Error loading products:", error?.message || error);
            if (targetPage === 1 && !preserveCurrent) {
                setProducts([]);
                setPages(1);
                setTotalProducts(0);
            }
            setFetchError(
                error?.message ||
                    "Unable to load products right now. Please check API server connectivity.",
            );
        } finally {
            if (
                requestId === latestLoadRequestRef.current &&
                showLoader &&
                targetPage === 1
            ) {
                setLoading(false);
            }
        }
    }, [buildQueryString]);

    const syncLoadedProducts = useCallback(() => {
        const loadedItemLimit = Math.max(page, 1) * PRODUCTS_PER_PAGE;
        return loadProducts({
            targetPage: 1,
            replace: true,
            limitOverride: loadedItemLimit,
            showLoader: false,
            preserveCurrent: true,
            skipCache: true,
        });
    }, [loadProducts, page]);

    const stopFallbackPolling = useCallback(() => {
        if (fallbackPollRef.current && typeof window !== "undefined") {
            window.clearInterval(fallbackPollRef.current);
        }
        fallbackPollRef.current = null;
    }, []);

    const startFallbackPolling = useCallback(() => {
        if (typeof window === "undefined" || fallbackPollRef.current) {
            return;
        }

        fallbackPollRef.current = window.setInterval(() => {
            void syncLoadedProducts();
        }, FALLBACK_POLL_INTERVAL_MS);
    }, [syncLoadedProducts]);

    useEffect(() => {
        void loadProducts({ targetPage: page, replace: page === 1 });
    }, [loadProducts, page]);

    useEffect(() => () => {
        stopFallbackPolling();
    }, [stopFallbackPolling]);

    useEffect(() => {
        const unsubscribeStock = subscribeToStockUpdates((payload) => {
            startTransition(() => {
                setProducts((prev) =>
                    applyStockUpdateToProductCollection(prev, payload),
                );
            });
        });

        const unsubscribeConnection = subscribeToStockConnection((event) => {
            if (event?.type === "fallback_active") {
                startFallbackPolling();
                return;
            }

            if (event?.type !== "connected" && event?.type !== "reconnected") {
                return;
            }

            stopFallbackPolling();
            if (event?.type === "reconnected") {
                void syncLoadedProducts();
            }
        });

        return () => {
            unsubscribeStock();
            unsubscribeConnection();
        };
    }, [startFallbackPolling, stopFallbackPolling, syncLoadedProducts]);

    useEffect(() => {
        setPage(1);
        setPages(1);
        setProducts([]);
        setTotalProducts(0);
    }, [
        activeSearchTerm,
        urlCategory,
        urlBestSeller,
        urlNewArrivals,
        urlPriceDrop,
        urlMinDiscount,
        urlMinPrice,
        urlMaxPrice,
        urlFlavor,
        urlProductType,
        urlSortBy,
        urlOrder,
    ]);

    useEffect(() => {
        if (!loaderRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0].isIntersecting) return;
                if (loading) return;
                if (fetchError) return;
                if (page >= pages) return;
                setPage((prev) => prev + 1);
            },
            { rootMargin: "220px" },
        );

        observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [loading, fetchError, page, pages]);

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        const nextSearch = String(searchTerm || "").trim();
        setActiveSearchTerm(nextSearch);
        const params = new URLSearchParams(searchParams.toString());
        if (nextSearch) params.set("search", nextSearch);
        else params.delete("search");
        const query = params.toString();
        pendingUrlSearchRef.current = nextSearch;
        router.push(query ? `/products?${query}` : "/products", {
            scroll: false,
        });
    };

    const replaceProductsParams = useCallback((updates = {}) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            const normalized = String(value ?? "").trim();
            if (!normalized || normalized === "all") {
                params.delete(key);
            } else {
                params.set(key, normalized);
            }
        });
        const query = params.toString();
        router.replace(query ? `/products?${query}` : "/products", {
            scroll: false,
        });
    }, [router, searchParams]);

    const applyPriceFilter = (priceFilter) => {
        replaceProductsParams({
            minPrice: priceFilter.min,
            maxPrice: priceFilter.max,
        });
    };

    const applySortOption = (option) => {
        replaceProductsParams({
            sortBy: option.sortBy,
            order: option.order,
            productType: option.productType || "",
        });
        setShowSort(false);
    };

    const clearFilters = () => {
        replaceProductsParams({
            minPrice: "",
            maxPrice: "",
            flavor: "",
            productType: "",
            bestSeller: "",
            newArrivals: "",
            priceDrop: "",
            minDiscount: "",
            category: "",
        });
    };

    const activePriceLabel =
        PRICE_FILTERS.find(
            (item) => item.min === urlMinPrice && item.max === urlMaxPrice,
        )?.label || "Custom price";
    const activeFlavorLabel =
        FLAVOR_FILTERS.find((item) => item.value === urlFlavor)?.label ||
        "All flavours";
    const activeProductTypeLabel =
        PRODUCT_TYPE_FILTERS.find((item) => item.value === urlProductType)
            ?.label || "All items";
    const activeSortLabel =
        SORT_OPTIONS.find(
            (item) => item.sortBy === urlSortBy && item.order === urlOrder,
        )?.label || "Newest first";
    const activeFilterCount = [
        urlMinPrice || urlMaxPrice,
        urlFlavor,
        urlProductType !== "all" ? urlProductType : "",
        urlBestSeller ? "bestSeller" : "",
        urlNewArrivals ? "newArrivals" : "",
        urlPriceDrop ? "priceDrop" : "",
        urlCategory,
    ].filter(Boolean).length;
    const {
        productItems,
        outOfStockProductItems,
        comboItems,
        outOfStockComboItems,
    } = useMemo(() => {
        const nextProductItems = [];
        const nextOutOfStockProductItems = [];
        const nextComboItems = [];
        const nextOutOfStockComboItems = [];

        products.forEach((product) => {
            const isComboItem = String(product?.itemType || "") === "combo";
            const isOutOfStock = isProductOutOfStock(product);

            if (isComboItem) {
                if (isOutOfStock) {
                    nextOutOfStockComboItems.push(product);
                    return;
                }

                nextComboItems.push(product);
                return;
            }

            if (isOutOfStock) {
                nextOutOfStockProductItems.push(product);
                return;
            }

            nextProductItems.push(product);
        });

        return {
            productItems: nextProductItems,
            outOfStockProductItems: nextOutOfStockProductItems,
            comboItems: nextComboItems,
            outOfStockComboItems: nextOutOfStockComboItems,
        };
    }, [products]);
    const drawerMode = showSort ? "sort" : "filters";
    const isDrawerOpen = showFilters || showSort;
    const closeDrawer = useCallback(() => {
        setShowFilters(false);
        setShowSort(false);
    }, []);

    useEffect(() => {
        if (!isDrawerOpen || typeof document === "undefined") return undefined;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleEscape = (event) => {
            if (event.key === "Escape") closeDrawer();
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener("keydown", handleEscape);
        };
    }, [closeDrawer, isDrawerOpen]);

    return (
        <div className="min-h-screen pb-20 pt-10">
            <div className="container mx-auto px-4">
                {/* Header Section */}
                <div className="flex flex-col gap-6 mb-12 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-2">
                            Our <span className="text-primary">Products</span>
                        </h1>
                        <p className="text-gray-500 font-medium">Explore our premium peanut butter collections</p>
                    </div>

                    <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[680px]">
                        {/* Search Bar */}
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                            <form
                                onSubmit={handleSearchSubmit}
                                className="relative col-span-2 w-full flex-1 group transition-all duration-500 sm:col-span-1"
                            >
                                <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-xl" />
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-[52px] pl-12 pr-5 bg-white/80 backdrop-blur-md border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all w-full font-bold text-sm shadow-sm sm:h-14 sm:rounded-3xl sm:pl-14 sm:text-base"
                                />
                            </form>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowFilters(true);
                                    setShowSort(false);
                                }}
                                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white/90 px-3 text-xs font-black text-gray-800 shadow-sm transition hover:border-primary/30 hover:text-primary sm:h-14 sm:w-auto sm:gap-2 sm:rounded-3xl sm:px-5 sm:text-sm"
                            >
                                <FiFilter className="text-lg" />
                                Filters
                                {activeFilterCount > 0 ? (
                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-xs">
                                        {activeFilterCount}
                                    </span>
                                ) : null}
                                <FiChevronDown className="text-gray-400" />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowSort(true);
                                    setShowFilters(false);
                                }}
                                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white/90 px-3 text-xs font-black text-gray-800 shadow-sm transition hover:border-primary/30 hover:text-primary sm:h-14 sm:w-auto sm:gap-2 sm:rounded-3xl sm:px-5 sm:text-sm"
                            >
                                <FiSliders className="text-lg" />
                                Sort
                                <FiChevronDown className="text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                {loading ? (
                    <ProductsGridSkeleton />
                ) : fetchError ? (
                    <div className="text-center py-20 bg-red-50/80 backdrop-blur-xl rounded-[40px] border border-red-200">
                        <h3 className="text-xl font-bold text-red-800 mb-2">Unable to load products</h3>
                        <p className="text-red-700">{fetchError}</p>
                        <p className="text-red-600 text-sm mt-2">Start backend API on localhost:8001 or localhost:8000.</p>
                    </div>
                ) : products.length > 0 ? (
                    <div className="space-y-6">
                        <p className="text-sm text-gray-500">
                            Showing {products.length} of {totalProducts || products.length} products
                        </p>
                        {productItems.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-lg font-black text-gray-900">Products</h2>
                                    <span className="text-xs font-bold text-gray-400">
                                        {productItems.length} items
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                                    {productItems.map((product) => (
                                        <ProductItem
                                            key={product._id}
                                            product={product}
                                            realtimeManagedExternally
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {outOfStockProductItems.length > 0 ? (
                            <div className="rounded-[32px] border border-[#f5d9d4] bg-[#fff7f5] p-5 md:p-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-black text-[#ef3b2d]">
                                            Few products are out of stock
                                        </h2>
                                        <p className="text-sm font-semibold text-gray-500">
                                            We&apos;re restocking soon
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-[#ff9f97]">
                                        {outOfStockProductItems.length} items
                                    </span>
                                </div>
                                <div className="mt-5 grid grid-cols-2 gap-6 md:gap-8 lg:grid-cols-4">
                                    {outOfStockProductItems.map((product) => (
                                        <ProductItem
                                            key={product._id}
                                            product={product}
                                            realtimeManagedExternally
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {comboItems.length > 0 ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 pt-2">
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/25 to-primary/10" />
                                    <div className="rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-center shadow-sm">
                                        <p className="text-xs font-black uppercase tracking-widest text-primary">
                                            Combo Deals
                                        </p>
                                    </div>
                                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-primary/25 to-primary/10" />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                                    {comboItems.map((product) => (
                                        <ProductItem
                                            key={product._id}
                                            product={product}
                                            realtimeManagedExternally
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {outOfStockComboItems.length > 0 ? (
                            <div className="rounded-[32px] border border-[#f5d9d4] bg-[#fff7f5] p-5 md:p-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-black text-[#ef3b2d]">
                                            Few combo deals are out of stock
                                        </h2>
                                        <p className="text-sm font-semibold text-gray-500">
                                            We&apos;re restocking soon
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-[#ff9f97]">
                                        {outOfStockComboItems.length} items
                                    </span>
                                </div>
                                <div className="mt-5 grid grid-cols-2 gap-6 md:gap-8 lg:grid-cols-4">
                                    {outOfStockComboItems.map((product) => (
                                        <ProductItem
                                            key={product._id}
                                            product={product}
                                            realtimeManagedExternally
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        <div ref={loaderRef} />
                        {page < pages ? (
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => setPage((prev) => prev + 1)}
                                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                                >
                                    Load more products
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white/30 backdrop-blur-xl rounded-[40px] border border-dashed border-gray-200">
                        <div className="text-6xl mb-4">🥜</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
                        <p className="text-gray-500">Try adjusting your search</p>
                    </div>
                )}
            </div>

            {isDrawerOpen ? (
                <div className="fixed inset-0 z-[80]">
                    <button
                        type="button"
                        aria-label="Close filters"
                        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
                        onClick={closeDrawer}
                    />
                    <aside className="absolute right-0 top-0 flex h-full w-[92vw] max-w-[430px] flex-col overflow-hidden rounded-l-[28px] bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-primary">
                                    Products
                                </p>
                                <h2 className="mt-1 text-2xl font-black text-gray-900">
                                    {drawerMode === "sort" ? "Sort by" : "Filters"}
                                </h2>
                                <p className="mt-1 text-sm font-semibold text-gray-500">
                                    {drawerMode === "sort"
                                        ? activeSortLabel
                                        : `${activePriceLabel} / ${activeFlavorLabel} / ${activeProductTypeLabel}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeDrawer}
                                aria-label="Close"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-primary/30 hover:text-primary"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5">
                            {drawerMode === "sort" ? (
                                <div className="grid gap-3">
                                    {SORT_OPTIONS.map((item) => {
                                        const active = item.sortBy === urlSortBy && item.order === urlOrder;
                                        return (
                                            <button
                                                key={`${item.sortBy}-${item.order}`}
                                                type="button"
                                                onClick={() => applySortOption(item)}
                                                className={`rounded-2xl border px-4 py-4 text-left text-base font-black transition ${active ? "border-primary bg-primary/10 text-primary" : "border-gray-100 text-gray-800 hover:border-primary/30 hover:bg-primary/5"}`}
                                            >
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-7">
                                    <section>
                                        <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Price</p>
                                        <div className="grid gap-3">
                                            {PRICE_FILTERS.map((item) => {
                                                const active = item.min === urlMinPrice && item.max === urlMaxPrice;
                                                return (
                                                    <button
                                                        key={`${item.min}-${item.max}-${item.label}`}
                                                        type="button"
                                                        onClick={() => applyPriceFilter(item)}
                                                        className={`rounded-2xl border px-4 py-3 text-left text-base font-black transition ${active ? "border-primary bg-primary/10 text-primary" : "border-gray-100 text-gray-800 hover:border-primary/30 hover:bg-primary/5"}`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    <section>
                                        <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Flavour</p>
                                        <div className="grid gap-3">
                                            {FLAVOR_FILTERS.map((item) => {
                                                const active = item.value === urlFlavor;
                                                return (
                                                    <button
                                                        key={item.value || "all-flavours"}
                                                        type="button"
                                                        onClick={() => replaceProductsParams({ flavor: item.value })}
                                                        className={`rounded-2xl border px-4 py-3 text-left text-base font-black transition ${active ? "border-primary bg-primary/10 text-primary" : "border-gray-100 text-gray-800 hover:border-primary/30 hover:bg-primary/5"}`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    <section>
                                        <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Product type</p>
                                        <div className="grid gap-3">
                                            {PRODUCT_TYPE_FILTERS.map((item) => {
                                                const active = item.value === urlProductType;
                                                return (
                                                    <button
                                                        key={item.value}
                                                        type="button"
                                                        onClick={() => replaceProductsParams({ productType: item.value })}
                                                        className={`rounded-2xl border px-4 py-3 text-left text-base font-black transition ${active ? "border-primary bg-primary/10 text-primary" : "border-gray-100 text-gray-800 hover:border-primary/30 hover:bg-primary/5"}`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>

                        {drawerMode === "filters" ? (
                            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 p-5">
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="h-12 rounded-2xl border border-gray-200 text-sm font-black text-gray-700 transition hover:border-primary/30 hover:text-primary"
                                >
                                    Clear all
                                </button>
                                <button
                                    type="button"
                                    onClick={closeDrawer}
                                    className="h-12 rounded-2xl bg-primary text-sm font-black text-white transition hover:bg-primary/90"
                                >
                                    Show products
                                </button>
                            </div>
                        ) : null}
                    </aside>
                </div>
            ) : null}

            {/* Decorative Gradients */}
            <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100/30 blur-[120px] rounded-full -z-10" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-100/30 blur-[120px] rounded-full -z-10" />
        </div>
    );
}

export default function ProductsPage() {
    return (
        <Suspense fallback={<ProductsGridSkeleton />}>
            <ProductsPageContent />
        </Suspense>
    );
}

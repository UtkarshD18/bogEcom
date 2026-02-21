"use client";

import ProductItem from "@/components/ProductItem";
import { fetchDataFromApi } from "@/utils/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";

const ProductsGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-[3/4] bg-gray-100 animate-pulse rounded-3xl" />
        ))}
    </div>
);

function ProductsPageContent() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const router = useRouter();

    // Get search term from URL
    const urlSearchTerm = searchParams.get("search") || "";
    const urlCategory = searchParams.get("category") || "";
    const [searchTerm, setSearchTerm] = useState(urlSearchTerm);

    // Sync state with URL when URL changes (e.g. from header search)
    useEffect(() => {
        setSearchTerm(urlSearchTerm);
    }, [urlSearchTerm]);

    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            try {
                const queryParams = new URLSearchParams();
                if (urlSearchTerm) queryParams.set("search", urlSearchTerm);
                if (urlCategory) queryParams.set("category", urlCategory);
                const queryString = queryParams.toString();
                const query = queryString ? `?${queryString}` : "";
                const res = await fetchDataFromApi(`/api/products${query}`);

                // Handle various API response structures (arrays, nested products, nested data)
                const productsData = Array.isArray(res) ? res : (res?.products || res?.data || res?.items || []);
                // Safety guard: even if API payload changes, keep exclusive items out of public products page.
                setProducts(productsData.filter((product) => product?.isExclusive !== true));
            } catch (error) {
                console.error("Error loading products:", error);
            } finally {
                setLoading(false);
            }
        };
        loadProducts();
    }, [urlSearchTerm, urlCategory]);

    // Handle search input change
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        // Debounce URL update
        const timeoutId = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) params.set("search", value);
            else params.delete("search");
            const query = params.toString();
            router.push(query ? `/products?${query}` : "/products");
        }, 500);

        return () => clearTimeout(timeoutId);
    };

    return (
        <div className="min-h-screen pb-20 pt-10">
            <div className="container mx-auto px-4">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-2">
                            Our <span className="text-primary">Products</span>
                        </h1>
                        <p className="text-gray-500 font-medium">Explore our premium peanut butter collections</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                        {/* Search Bar */}
                        <div className="w-full max-w-2xl relative group transition-all duration-500">
                            <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-xl" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className="pl-14 pr-8 py-5 bg-white/70 backdrop-blur-md border border-gray-100 rounded-3xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all w-full font-bold text-base shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                {loading ? (
                    <ProductsGridSkeleton />
                ) : products.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                        {products.map((product) => (
                            <ProductItem key={product._id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white/30 backdrop-blur-xl rounded-[40px] border border-dashed border-gray-200">
                        <div className="text-6xl mb-4">🥜</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
                        <p className="text-gray-500">Try adjusting your search</p>
                    </div>
                )}
            </div>

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

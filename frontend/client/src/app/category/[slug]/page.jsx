import { redirect } from "next/navigation";

export default async function CategoryRedirectPage({ params }) {
  const resolvedParams = await params;
  const slug = encodeURIComponent(String(resolvedParams?.slug || "").trim());

  if (!slug) {
    redirect("/products");
  }

  redirect(`/products?category=${slug}`);
}


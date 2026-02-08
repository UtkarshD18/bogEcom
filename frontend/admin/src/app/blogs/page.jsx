"use client";
import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData } from "@/utils/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { MdOutlineArticle } from "react-icons/md";

const BlogsPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const [blogs, setBlogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBlogs = useCallback(async () => {
    try {
      setIsLoading(true);

      // Ensure token is available
      if (!token || typeof token !== "string") {
        console.warn("Token not available, skipping blog fetch");
        setBlogs([]);
        setIsLoading(false);
        return;
      }

      const response = await getData("/api/blogs/admin/all", token);
      if (response.success && response.data) {
        setBlogs(Array.isArray(response.data) ? response.data : []);
      } else {
        setBlogs([]);
      }
    } catch (error) {
      console.error("Error fetching blogs:", error);
      toast.error("Failed to fetch blogs");
      setBlogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBlogs();
    }
  }, [isAuthenticated, token, fetchBlogs]);

  const handleDelete = async (blogId) => {
    if (!confirm("Are you sure you want to delete this blog?")) {
      return;
    }

    try {
      const response = await deleteData(`/api/blogs/${blogId}`, token);
      if (response.success) {
        toast.success("Blog deleted successfully!");
        fetchBlogs();
      } else {
        toast.error(response.message || "Failed to delete blog");
      }
    } catch (error) {
      console.error("Error deleting blog:", error);
      toast.error("Failed to delete blog");
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10 flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Blogs
          </h1>
          <div className="h-1 w-14 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full mt-2"></div>
          <p className="text-gray-500 mt-3 text-lg">
            All your blog posts in one place
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/blogs-page">
            <button className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-800 px-6 py-3 rounded-xl shadow-sm hover:shadow transition-all duration-300">
              Page Settings
            </button>
          </Link>
          <Link href="/blogs/add-blog">
            <button className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
              <MdOutlineArticle size={20} />
              Add New Blog
            </button>
          </Link>
        </div>
      </div>

      {/* Blog Cards */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow">
          <MdOutlineArticle size={60} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">
            No blogs found. Create your first blog!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {blogs.map((blog) => (
            <div
              key={blog._id}
              className="bg-white rounded-2xl shadow hover:shadow-xl transition overflow-hidden"
            >
              {/* Image */}
              <img
                src={blog.image || "https://picsum.photos/600/400"}
                alt={blog.title}
                className="w-full h-40 object-cover"
              />

              <div className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-xl text-gray-800">
                      {blog.title}
                    </h3>
                    <p className="text-gray-500 mt-1 text-sm line-clamp-2">
                      {blog.description}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/blogs/${blog._id}`}>
                      <button className="text-blue-600 hover:text-blue-800 p-2">
                        <FiEdit2 size={20} />
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDelete(blog._id)}
                      className="text-red-600 hover:text-red-800 p-2"
                    >
                      <FiTrash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  Created: {new Date(blog.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlogsPage;

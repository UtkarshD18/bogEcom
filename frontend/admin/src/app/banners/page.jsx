"use client";
import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import { Button } from "@mui/material";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FaRegTrashAlt } from "react-icons/fa";
import { FiImage, FiVideo } from "react-icons/fi";
import { IoEyeOutline } from "react-icons/io5";
import { RiEdit2Line } from "react-icons/ri";

const columns = [
  { id: "MEDIA", label: "MEDIA", minWidth: 300 },
  { id: "TITLE", label: "TITLE", minWidth: 150 },
  { id: "TYPE", label: "TYPE", minWidth: 80 },
  { id: "POSITION", label: "POSITION", minWidth: 100 },
  { id: "STATUS", label: "STATUS", minWidth: 80 },
  { id: "ACTIONS", label: "ACTIONS", minWidth: 200 },
];

const Banners = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBanners = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData("/api/banners/admin/all", token);
      if (response.success) {
        setBanners(response.data || []);
      } else {
        setBanners([]);
      }
    } catch (error) {
      console.error("Failed to fetch banners:", error);
      setBanners([]);
    }
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBanners();
    }
  }, [isAuthenticated, fetchBanners]);

  const handleDeleteBanner = async (bannerId) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      const response = await deleteData(`/api/banners/${bannerId}`, token);
      if (response.success) {
        toast.success("Banner deleted successfully");
        fetchBanners();
      } else {
        toast.error(response.message || "Failed to delete banner");
      }
    } catch (error) {
      toast.error("Failed to delete banner");
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
    <section className="w-full py-3 px-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] text-gray-700 font-[600]">Banners</h2>
        <Link href="/banners/add-banner">
          <Button
            className="!bg-blue-600 !text-white !px-4 !py-2 !rounded-md hover:!bg-blue-700"
            size="small"
          >
            Add Banner
          </Button>
        </Link>
      </div>

      <div className="w-full p-4 rounded-md shadow-md bg-white mt-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No banners found. Add your first banner!</p>
          </div>
        ) : (
          <TableContainer sx={{ maxHeight: 440 }}>
            <Table stickyHeader aria-label="banners table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align}
                      style={{ minWidth: column.minWidth }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {banners.map((banner, index) => (
                  <TableRow key={banner._id || index}>
                    <TableCell className="!px-0">
                      <div className="flex items-center gap-3">
                        <div className="img bg-white rounded-md w-[400px] h-[118px] overflow-hidden relative">
                          {/* Show video or image based on mediaType */}
                          {banner.mediaType === "video" && banner.videoUrl ? (
                            <video
                              src={banner.videoUrl}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                              autoPlay
                              poster={getImageUrl(banner.image)}
                            />
                          ) : (
                            <img
                              src={getImageUrl(banner.image)}
                              alt="banner image"
                              className="w-full h-full object-cover hover:scale-105 transition-all"
                            />
                          )}
                          {/* Video indicator badge */}
                          {banner.mediaType === "video" && (
                            <span className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <FiVideo size={12} /> Video
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-medium text-gray-800">
                        {banner.title}
                      </span>
                      {banner.subtitle && (
                        <p className="text-gray-500 text-sm">
                          {banner.subtitle}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-sm flex items-center gap-1 w-fit ${
                          banner.mediaType === "video"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {banner.mediaType === "video" ? (
                          <>
                            <FiVideo size={14} /> Video
                          </>
                        ) : (
                          <>
                            <FiImage size={14} /> Image
                          </>
                        )}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {banner.position}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-sm ${banner.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {banner.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/banners/edit/${banner._id}`}>
                          <Button className="!w-[40px] !h-[40px] !min-w-[20px] !rounded-full !text-gray-900">
                            <RiEdit2Line size={20} />
                          </Button>
                        </Link>

                        <Button className="!w-[40px] !h-[40px] !min-w-[20px] !rounded-full !text-gray-900">
                          <IoEyeOutline size={20} />
                        </Button>

                        <Button
                          className="!w-[40px] !h-[40px] !min-w-[20px] !rounded-full !text-red-600"
                          onClick={() => handleDeleteBanner(banner._id)}
                        >
                          <FaRegTrashAlt size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </section>
  );
};

export default Banners;

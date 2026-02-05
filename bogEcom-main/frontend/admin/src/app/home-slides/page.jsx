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
import { IoEyeOutline } from "react-icons/io5";
import { RiEdit2Line } from "react-icons/ri";

const columns = [
  { id: "IMAGE", label: "IMAGE", minWidth: 300 },
  { id: "TITLE", label: "TITLE", minWidth: 150 },
  { id: "STATUS", label: "STATUS", minWidth: 80 },
  { id: "ACTIONS", label: "ACTIONS", minWidth: 200 },
];

const HomeSlides = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const [slides, setSlides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSlides = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData("/api/home-slides/admin/all", token);
      if (response.success) {
        setSlides(response.data || []);
      } else {
        setSlides([]);
      }
    } catch (error) {
      console.error("Failed to fetch slides:", error);
      setSlides([]);
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
      fetchSlides();
    }
  }, [isAuthenticated, fetchSlides]);

  const handleDeleteSlide = async (slideId) => {
    if (!confirm("Are you sure you want to delete this slide?")) return;

    try {
      const response = await deleteData(`/api/home-slides/${slideId}`, token);
      if (response.success) {
        toast.success("Slide deleted successfully");
        fetchSlides();
      } else {
        toast.error(response.message || "Failed to delete slide");
      }
    } catch (error) {
      toast.error("Failed to delete slide");
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
        <h2 className="text-[18px] text-gray-700 font-[600]">Home Slides</h2>
        <Link href="/home-slides/add-home-slide">
          <Button
            className="!bg-blue-600 !text-white !px-4 !py-2 !rounded-md hover:!bg-blue-700"
            size="small"
          >
            Add Home Slide
          </Button>
        </Link>
      </div>

      <div className="w-full p-4 rounded-md shadow-md bg-white mt-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : slides.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No slides found. Add your first home slide!</p>
          </div>
        ) : (
          <TableContainer sx={{ maxHeight: 440 }}>
            <Table stickyHeader aria-label="slides table">
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
                {slides.map((slide, index) => (
                  <TableRow key={slide._id || index}>
                    <TableCell className="!px-0">
                      <div className="flex items-center gap-3">
                        <div className="img bg-white rounded-md w-[400px] h-[118px] overflow-hidden">
                          <img
                            src={getImageUrl(slide.image)}
                            alt="slide image"
                            className="w-full h-full object-cover hover:scale-105 transition-all"
                          />
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-medium text-gray-800">
                        {slide.title}
                      </span>
                      {slide.subtitle && (
                        <p className="text-gray-500 text-sm">
                          {slide.subtitle}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-sm ${slide.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {slide.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/home-slides/edit/${slide._id}`}>
                          <Button className="!w-[40px] !h-[40px] !min-w-[20px] !rounded-full !text-gray-900">
                            <RiEdit2Line size={20} />
                          </Button>
                        </Link>

                        <Button className="!w-[40px] !h-[40px] !min-w-[20px] !rounded-full !text-gray-900">
                          <IoEyeOutline size={20} />
                        </Button>

                        <Button
                          className="!w-[40px] !h-[40px] !min-w-[20px] !rounded-full !text-red-600"
                          onClick={() => handleDeleteSlide(slide._id)}
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

export default HomeSlides;

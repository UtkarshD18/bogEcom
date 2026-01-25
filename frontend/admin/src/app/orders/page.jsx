"use client";
import { useAdmin } from "@/context/AdminContext";
import { getData, putData } from "@/utils/api";
import { Button } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FaAngleDown } from "react-icons/fa6";
import { FiSearch } from "react-icons/fi";
import { MdDateRange } from "react-icons/md";

const OrderRow = ({ order, index, token, onStatusUpdate }) => {
  const [expandIndex, setExpandIndex] = useState(false);
  const [orderStatus, setOrderStatus] = useState(
    order?.order_status || "confirm",
  );
  const [updating, setUpdating] = useState(false);

  const handleChange = async (event) => {
    const newStatus = event.target.value;
    setUpdating(true);
    try {
      const response = await putData(
        `/api/orders/${order._id}/status`,
        { status: newStatus },
        token,
      );
      if (response.success) {
        setOrderStatus(newStatus);
        toast.success("Order status updated");
        if (onStatusUpdate) onStatusUpdate();
      } else {
        toast.error(response.message || "Failed to update status");
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
    setUpdating(false);
  };

  return (
    <>
      <tr className="border-b-[1px] border-[rgba(0,0,0,0.1)] hover:bg-gray-50">
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 font-bold">
          <Button
            className="!min-w-[40px] !h-[40px] !w-[40px] !rounded-full !text-gray-500 !bg-gray-100 hover:!bg-gray-200"
            onClick={() => setExpandIndex(!expandIndex)}
          >
            <FaAngleDown
              size={20}
              className={`transition-all ${expandIndex && "rotate-180"}`}
            />
          </Button>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 font-bold">
          #{order?._id?.slice(-6) || "------"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className="flex items-center gap-3 w-[300px]">
            <div className="rounded-full w-[50px] h-[50px] overflow-hidden bg-gray-200">
              <img
                src={order?.user?.avatar || "/Profile1.png"}
                alt="user"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="info flex flex-col gap-0">
              <span className="text-gray-800 text-[14px]">
                {order?.user?.name || "Customer Name"}
              </span>
              <span className="text-gray-500 text-[14px]">
                {order?.user?.email || "customer@email.com"}
              </span>
            </div>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 whitespace-nowrap">
          {order?.paymentId || "N/A"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 whitespace-nowrap">
          {order?.user?.mobile || order?.delivery_address?.mobile || "N/A"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className="w-[350px] py-3">
            <span className="bg-gray-100 rounded-md px-2 py-1 border border-[rgba(0,0,0,0.1)]">
              {order?.delivery_address?.addressType || "Home"}
            </span>
            <p className="pt-2">
              {order?.delivery_address
                ? `${order.delivery_address.address_line || ""}, ${order.delivery_address.city || ""}, ${order.delivery_address.state || ""}`
                : "No address"}
            </p>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          {order?.delivery_address?.pincode || "N/A"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          ₹{order?.totalAmt || "0"}
        </td>
        <td className="text-[14px] text-gray-600 px-4 py-2 whitespace-nowrap text-primary font-bold">
          {order?.user?._id?.slice(-6) || "------"}
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <Select
            value={orderStatus}
            onChange={handleChange}
            displayEmpty
            inputProps={{ "aria-label": "Without label" }}
            size="small"
            disabled={updating}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="confirm">Confirm</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="shipped">Shipped</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <MdDateRange size={20} />
            {order?.createdAt
              ? new Date(order.createdAt).toLocaleDateString()
              : new Date().toLocaleDateString()}
          </div>
        </td>
      </tr>
      {expandIndex && (
        <tr className="bg-gray-100">
          <td colSpan={11} className="p-5">
            <div className="flex flex-wrap gap-4">
              {(order?.products || []).map((product, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm"
                >
                  <div className="img rounded-md overflow-hidden w-[80px] h-[80px] bg-gray-100">
                    <img
                      src={product?.image || "/placeholder.png"}
                      alt="product"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="info flex flex-col">
                    <h2 className="text-gray-900 text-[15px] font-[500]">
                      {product?.productTitle || "Product Name"}
                    </h2>
                    <span className="text-gray-600 text-[13px] font-[500]">
                      Qty: {product?.quantity || 1} × ₹{product?.price || 0}
                    </span>
                    <span className="text-green-600 text-[13px] font-[600]">
                      Subtotal: ₹
                      {product?.subTotal ||
                        product?.quantity * product?.price ||
                        0}
                    </span>
                  </div>
                </div>
              ))}
              {(!order?.products || order.products.length === 0) && (
                <p className="text-gray-500">No product details available</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const Orders = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, page]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      let url = `/api/orders/admin/all?page=${page}&limit=20`;
      if (search) url += `&search=${search}`;

      const response = await getData(url, token);
      if (response.success) {
        setOrders(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
      } else {
        setOrders([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setOrders([]);
      setTotalPages(1);
    }
    setIsLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="wrapper w-full p-4">
      <div className="bg-white shadow-md rounded-md mb-5 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="info">
            <h1 className="text-[20px] font-[600] text-gray-600">Orders</h1>
            <p className="text-gray-500">
              There {orders.length === 1 ? "is" : "are"}{" "}
              <span className="text-primary font-bold">{orders.length}</span>{" "}
              {orders.length === 1 ? "order" : "orders"}
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search Order..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-[300px] outline-none focus:border-blue-500"
              />
            </div>
          </form>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No orders found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto w-full mt-5 scroll">
              <table className="w-full">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left border-b-[1px] border-[rgba(0,0,0,0.1)]"></th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Order Id
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Customer
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Payment Id
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Phone Number
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Address
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Pincode
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Total Amount
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      User Id
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Order Status
                    </th>
                    <th className="text-[14px] text-gray-700 font-[600] px-4 py-3 whitespace-nowrap text-left">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <OrderRow
                      key={order._id || index}
                      order={order}
                      index={index}
                      token={token}
                      onStatusUpdate={fetchOrders}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-center py-10">
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                showFirstButton
                showLastButton
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Orders;

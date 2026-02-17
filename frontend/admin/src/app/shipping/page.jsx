"use client";

import { API_BASE_URL } from "@/utils/api";

import { useAdmin } from "@/context/AdminContext";
import {
  Button,
  CircularProgress,
  TextField,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { MdLocalShipping, MdOutlineTrackChanges } from "react-icons/md";
import { FaBoxOpen, FaFilePdf, FaRegTimesCircle } from "react-icons/fa";

const API_URL = API_BASE_URL;

const ShippingAdminPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [serviceability, setServiceability] = useState({
    origin: "",
    destination: "",
    payment_type: "cod",
    order_amount: "",
    weight: "500",
    length: "10",
    breadth: "10",
    height: "10",
  });
  const [serviceabilityResponse, setServiceabilityResponse] = useState(null);

  const [trackAwb, setTrackAwb] = useState("");
  const [trackOrderId, setTrackOrderId] = useState("");
  const [trackResponse, setTrackResponse] = useState(null);

  const [cancelAwb, setCancelAwb] = useState("");
  const [cancelOrderId, setCancelOrderId] = useState("");
  const [cancelResponse, setCancelResponse] = useState(null);

  const [manifestAwbs, setManifestAwbs] = useState("");
  const [manifestOrderId, setManifestOrderId] = useState("");
  const [manifestResponse, setManifestResponse] = useState(null);

  const [bookOrderId, setBookOrderId] = useState("");
  const [bookJson, setBookJson] = useState("");
  const [bookResponse, setBookResponse] = useState(null);

  const [loadingAction, setLoadingAction] = useState(false);
  const [includeOrderSync, setIncludeOrderSync] = useState(true);

  const request = useCallback(
    async (path, method = "POST", body = null) => {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();
      if (!data?.success) {
        throw new Error(data?.message || "Shipping request failed");
      }
      return data;
    },
    [token],
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  const handleServiceability = async () => {
    try {
      setLoadingAction(true);
      const payload = {
        ...serviceability,
      };
      const response = await request(
        "/api/shipping/xpressbees/serviceability",
        "POST",
        payload,
      );
      setServiceabilityResponse(response);
      toast.success("Serviceability fetched");
    } catch (error) {
      toast.error(error.message || "Failed to fetch serviceability");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTrack = async () => {
    try {
      if (!trackAwb) {
        toast.error("Please enter AWB number");
        return;
      }
      setLoadingAction(true);
      const suffix = includeOrderSync && trackOrderId ? `?orderId=${trackOrderId}` : "";
      const response = await request(
        `/api/shipping/xpressbees/track/${trackAwb}${suffix}`,
        "GET",
      );
      setTrackResponse(response);
      toast.success("Tracking fetched");
    } catch (error) {
      toast.error(error.message || "Failed to track shipment");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCancel = async () => {
    try {
      if (!cancelAwb) {
        toast.error("Please enter AWB number");
        return;
      }
      setLoadingAction(true);
      const response = await request(
        "/api/shipping/xpressbees/cancel",
        "POST",
        {
          awb: cancelAwb,
          orderId: includeOrderSync ? cancelOrderId : null,
        },
      );
      setCancelResponse(response);
      toast.success("Shipment cancelled");
    } catch (error) {
      toast.error(error.message || "Failed to cancel shipment");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleManifest = async () => {
    try {
      const awbs = manifestAwbs
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (awbs.length === 0) {
        toast.error("Enter at least one AWB");
        return;
      }

      setLoadingAction(true);
      const response = await request(
        "/api/shipping/xpressbees/manifest",
        "POST",
        { awbs, orderId: includeOrderSync ? manifestOrderId : null },
      );
      setManifestResponse(response);
      const manifestUrl =
        response?.data?.data?.manifest ||
        response?.data?.manifest ||
        response?.data?.data?.manifest_url ||
        null;
      if (manifestUrl && typeof window !== "undefined") {
        window.open(manifestUrl, "_blank", "noopener,noreferrer");
      }
      toast.success("Manifest generated");
    } catch (error) {
      toast.error(error.message || "Failed to generate manifest");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleBookShipment = async () => {
    try {
      if (!bookJson) {
        toast.error("Paste shipment JSON payload");
        return;
      }

      let shipmentPayload;
      try {
        shipmentPayload = JSON.parse(bookJson);
      } catch (err) {
        toast.error("Invalid JSON payload");
        return;
      }

      setLoadingAction(true);
      const response = await request(
        "/api/shipping/xpressbees/book",
        "POST",
        {
          orderId: includeOrderSync ? bookOrderId : null,
          shipment: shipmentPayload,
        },
      );
      setBookResponse(response);
      toast.success("Shipment booked");
    } catch (error) {
      toast.error(error.message || "Failed to book shipment");
    } finally {
      setLoadingAction(false);
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Shipping Console</h1>
          <p className="text-gray-500">
            Manage Xpressbees booking, tracking, and manifests
          </p>
        </div>
        <FormControlLabel
          control={
            <Switch
              checked={includeOrderSync}
              onChange={(e) => setIncludeOrderSync(e.target.checked)}
              color="warning"
            />
          }
          label="Sync updates to orders"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <MdLocalShipping className="text-xl text-orange-500" />
            <h2 className="font-semibold text-gray-800">Serviceability</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Origin Pincode"
              value={serviceability.origin}
              onChange={(e) =>
                setServiceability({ ...serviceability, origin: e.target.value })
              }
              size="small"
            />
            <TextField
              label="Destination Pincode"
              value={serviceability.destination}
              onChange={(e) =>
                setServiceability({
                  ...serviceability,
                  destination: e.target.value,
                })
              }
              size="small"
            />
            <TextField
              label="Payment Type (cod/prepaid)"
              value={serviceability.payment_type}
              onChange={(e) =>
                setServiceability({
                  ...serviceability,
                  payment_type: e.target.value,
                })
              }
              size="small"
            />
            <TextField
              label="Order Amount"
              value={serviceability.order_amount}
              onChange={(e) =>
                setServiceability({
                  ...serviceability,
                  order_amount: e.target.value,
                })
              }
              size="small"
            />
            <TextField
              label="Weight (g)"
              value={serviceability.weight}
              onChange={(e) =>
                setServiceability({ ...serviceability, weight: e.target.value })
              }
              size="small"
            />
            <TextField
              label="Length (cm)"
              value={serviceability.length}
              onChange={(e) =>
                setServiceability({ ...serviceability, length: e.target.value })
              }
              size="small"
            />
            <TextField
              label="Breadth (cm)"
              value={serviceability.breadth}
              onChange={(e) =>
                setServiceability({ ...serviceability, breadth: e.target.value })
              }
              size="small"
            />
            <TextField
              label="Height (cm)"
              value={serviceability.height}
              onChange={(e) =>
                setServiceability({ ...serviceability, height: e.target.value })
              }
              size="small"
            />
          </div>
          <Button
            variant="contained"
            sx={{ mt: 3, bgcolor: "#059669", "&:hover": { bgcolor: "#047857" } }}
            onClick={handleServiceability}
            disabled={loadingAction}
          >
            {loadingAction ? <CircularProgress size={20} color="inherit" /> : "Check Serviceability"}
          </Button>
          {serviceabilityResponse && (
            <pre className="mt-4 bg-gray-50 border rounded-lg p-3 text-xs overflow-auto">
{JSON.stringify(serviceabilityResponse, null, 2)}
            </pre>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <MdOutlineTrackChanges className="text-xl text-blue-500" />
            <h2 className="font-semibold text-gray-800">Track Shipment</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <TextField
              label="AWB Number"
              value={trackAwb}
              onChange={(e) => setTrackAwb(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Order ID (optional)"
              value={trackOrderId}
              onChange={(e) => setTrackOrderId(e.target.value)}
              size="small"
              fullWidth
            />
          </div>
          <Button
            variant="outlined"
            sx={{ mt: 3 }}
            onClick={handleTrack}
            disabled={loadingAction}
          >
            Track
          </Button>
          {trackResponse && (
            <pre className="mt-4 bg-gray-50 border rounded-lg p-3 text-xs overflow-auto">
{JSON.stringify(trackResponse, null, 2)}
            </pre>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FaRegTimesCircle className="text-xl text-red-500" />
            <h2 className="font-semibold text-gray-800">Cancel Shipment</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <TextField
              label="AWB Number"
              value={cancelAwb}
              onChange={(e) => setCancelAwb(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Order ID (optional)"
              value={cancelOrderId}
              onChange={(e) => setCancelOrderId(e.target.value)}
              size="small"
              fullWidth
            />
          </div>
          <Button
            variant="outlined"
            color="error"
            sx={{ mt: 3 }}
            onClick={handleCancel}
            disabled={loadingAction}
          >
            Cancel Shipment
          </Button>
          {cancelResponse && (
            <pre className="mt-4 bg-gray-50 border rounded-lg p-3 text-xs overflow-auto">
{JSON.stringify(cancelResponse, null, 2)}
            </pre>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FaFilePdf className="text-xl text-purple-500" />
            <h2 className="font-semibold text-gray-800">Manifest</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <TextField
              label="AWBs (comma separated)"
              value={manifestAwbs}
              onChange={(e) => setManifestAwbs(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Order ID (optional)"
              value={manifestOrderId}
              onChange={(e) => setManifestOrderId(e.target.value)}
              size="small"
              fullWidth
            />
          </div>
          <Button
            variant="outlined"
            sx={{ mt: 3 }}
            onClick={handleManifest}
            disabled={loadingAction}
          >
            Generate Manifest
          </Button>
          {manifestResponse && (
            <pre className="mt-4 bg-gray-50 border rounded-lg p-3 text-xs overflow-auto">
{JSON.stringify(manifestResponse, null, 2)}
            </pre>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <FaBoxOpen className="text-xl text-green-500" />
            <h2 className="font-semibold text-gray-800">Book Shipment</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <TextField
              label="Order ID (optional)"
              value={bookOrderId}
              onChange={(e) => setBookOrderId(e.target.value)}
              size="small"
              fullWidth
            />
            <div className="text-sm text-gray-500 flex items-center">
              Paste full shipment JSON payload from order details.
            </div>
          </div>
          <TextField
            label="Shipment JSON"
            value={bookJson}
            onChange={(e) => setBookJson(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={6}
            placeholder='{"order_number":"#123456","payment_type":"cod",...}'
          />
          <Button
            variant="contained"
            sx={{ mt: 3, bgcolor: "#059669", "&:hover": { bgcolor: "#047857" } }}
            onClick={handleBookShipment}
            disabled={loadingAction}
          >
            Book Shipment
          </Button>
          {bookResponse && (
            <pre className="mt-4 bg-gray-50 border rounded-lg p-3 text-xs overflow-auto">
{JSON.stringify(bookResponse, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShippingAdminPage;

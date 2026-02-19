"use client";

import { fetchDataFromApi, getStoredAccessToken } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";

const EMPTY_STATUS = {
  isMember: false,
  isExpired: false,
  membershipPlan: null,
  membershipExpiry: null,
};

export const useMembership = ({ autoFetch = true } = {}) => {
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchMembership = useCallback(async () => {
    const accessToken = getStoredAccessToken();
    const authenticated = Boolean(accessToken);
    setIsAuthenticated(authenticated);

    if (!authenticated) {
      setStatus(EMPTY_STATUS);
      setError("");
      setLoading(false);
      return { isAuthenticated: false, isActiveMember: false };
    }

    try {
      setLoading(true);
      const response = await fetchDataFromApi("/api/membership/status");
      if (response?.success && response?.data) {
        const nextStatus = {
          ...EMPTY_STATUS,
          ...response.data,
        };
        setStatus(nextStatus);
        setError("");

        return {
          isAuthenticated: true,
          isActiveMember: Boolean(nextStatus.isMember) && !nextStatus.isExpired,
          status: nextStatus,
        };
      }

      setStatus(EMPTY_STATUS);
      setError(response?.message || "Failed to fetch membership status");
      return { isAuthenticated: true, isActiveMember: false };
    } catch (fetchError) {
      setStatus(EMPTY_STATUS);
      setError(fetchError?.message || "Failed to fetch membership status");
      return { isAuthenticated: true, isActiveMember: false };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    fetchMembership();
  }, [autoFetch, fetchMembership]);

  const isActiveMember =
    isAuthenticated && Boolean(status?.isMember) && !status?.isExpired;

  return {
    status,
    isAuthenticated,
    isActiveMember,
    loading,
    error,
    refetch: fetchMembership,
  };
};

export default useMembership;

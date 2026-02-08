const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  .trim()
  .replace(/\/+$/, "");
const isProduction = process.env.NODE_ENV === "production";
// Dev-only logging to avoid leaking auth details in production
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const refreshAdminToken = async () => {
  try {
    const response = await fetch(`${apiUrl}/api/user/refresh-token`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const token = data?.data?.accessToken || null;
    if (token) {
      localStorage.setItem("adminToken", token);
    }
    return token;
  } catch (error) {
    console.error("refreshAdminToken error:", error);
    return null;
  }
};

export const postData = async (URL, formData, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      debugLog("postData token debug:", {
        tokenType: typeof token,
        tokenLength: token
          ? typeof token === "string"
            ? token.length
            : "not-a-string"
          : 0,
        isString: typeof token === "string",
        isObject: typeof token === "object",
      });
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(`${apiUrl}${URL}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(formData),
    });

    if (response.status === 401) {
      const newToken = await refreshAdminToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(`${apiUrl}${URL}`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(formData),
        });
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("postData error:", error);
    return { error: true, message: error.message };
  }
};

// Upload single file
export const uploadFile = async (file, token) => {
  try {
    // Ensure token is a string
    if (!token || typeof token !== "string") {
      console.error("No valid token provided to uploadFile", {
        hasToken: !!token,
        tokenType: typeof token,
      });
      return {
        error: true,
        message: "Authentication token is missing or invalid",
      };
    }

    const formData = new FormData();
    formData.append("image", file);

    debugLog("uploadFile debug:", {
      hasToken: !!token,
      tokenLength: token.length,
      fileName: file.name,
    });

    const response = await fetch(`${apiUrl}/api/upload/single`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("uploadFile error:", error);
    return { error: true, message: error.message };
  }
};

// Upload video file
export const uploadVideoFile = async (file, token) => {
  try {
    if (!token || typeof token !== "string") {
      return {
        error: true,
        message: "Authentication token is missing or invalid",
      };
    }

    const formData = new FormData();
    formData.append("video", file);

    debugLog("uploadVideoFile debug:", {
      hasToken: !!token,
      fileName: file.name,
      fileSize: file.size,
    });

    const response = await fetch(`${apiUrl}/api/upload/video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("uploadVideoFile error:", error);
    return { error: true, message: error.message };
  }
};

// Upload multiple files
export const uploadFiles = async (files, token) => {
  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    const response = await fetch(`${apiUrl}/api/upload/multiple`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("uploadFiles error:", error);
    return { error: true, message: error.message };
  }
};

export const getData = async (URL, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      debugLog("getData token debug:", {
        tokenType: typeof token,
        tokenLength: token
          ? typeof token === "string"
            ? token.length
            : "not-a-string"
          : 0,
        isString: typeof token === "string",
        isObject: typeof token === "object",
      });
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(`${apiUrl}${URL}`, {
      method: "GET",
      headers,
      credentials: "include",
    });

    if (response.status === 401) {
      const newToken = await refreshAdminToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(`${apiUrl}${URL}`, {
          method: "GET",
          headers,
          credentials: "include",
        });
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("getData error:", error);
    return { error: true, message: error.message };
  }
};

export const putData = async (URL, formData, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      debugLog("putData token debug:", {
        tokenType: typeof token,
        tokenLength: token
          ? typeof token === "string"
            ? token.length
            : "not-a-string"
          : 0,
        isString: typeof token === "string",
        isObject: typeof token === "object",
      });
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(`${apiUrl}${URL}`, {
      method: "PUT",
      headers,
      credentials: "include",
      body: JSON.stringify(formData),
    });

    if (response.status === 401) {
      const newToken = await refreshAdminToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(`${apiUrl}${URL}`, {
          method: "PUT",
          headers,
          credentials: "include",
          body: JSON.stringify(formData),
        });
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("putData error:", error);
    return { error: true, message: error.message };
  }
};

export const deleteData = async (URL, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      debugLog("deleteData token debug:", {
        tokenType: typeof token,
        tokenLength: token
          ? typeof token === "string"
            ? token.length
            : "not-a-string"
          : 0,
        isString: typeof token === "string",
        isObject: typeof token === "object",
      });
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(`${apiUrl}${URL}`, {
      method: "DELETE",
      headers,
      credentials: "include",
    });

    if (response.status === 401) {
      const newToken = await refreshAdminToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(`${apiUrl}${URL}`, {
          method: "DELETE",
          headers,
          credentials: "include",
        });
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("deleteData error:", error);
    return { error: true, message: error.message };
  }
};

export const patchData = async (URL, formData, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(`${apiUrl}${URL}`, {
      method: "PATCH",
      headers,
      credentials: "include",
      body: JSON.stringify(formData),
    });

    if (response.status === 401) {
      const newToken = await refreshAdminToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(`${apiUrl}${URL}`, {
          method: "PATCH",
          headers,
          credentials: "include",
          body: JSON.stringify(formData),
        });
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("patchData error:", error);
    return { error: true, message: error.message };
  }
};

export const getDashboardStats = async (token) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };
    if (token && typeof token === "string") {
      headers["Authorization"] = `Bearer ${token}`;
    }
    let response = await fetch(`${apiUrl}/api/statistics/dashboard`, {
      method: "GET",
      headers,
      credentials: "include",
    });
    if (response.status === 401) {
      const newToken = await refreshAdminToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(`${apiUrl}/api/statistics/dashboard`, {
          method: "GET",
          headers,
          credentials: "include",
        });
      }
    }
    if (!response.ok) {
      // Not status 200, return error
      return {
        error: true,
        message: `Request failed with status ${response.status}`,
      };
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("getDashboardStats error:", error);
    return { error: true, message: error.message };
  }
};

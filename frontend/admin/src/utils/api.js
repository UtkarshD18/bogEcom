const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const postData = async (URL, formData, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      console.log("postData token debug:", {
        tokenType: typeof token,
        tokenLength: token
          ? typeof token === "string"
            ? token.length
            : "not-a-string"
          : 0,
        isString: typeof token === "string",
        isObject: typeof token === "object",
        tokenValue:
          typeof token === "string"
            ? token.substring(0, 20)
            : String(token).substring(0, 20),
      });
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${apiUrl}${URL}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(formData),
    });

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

    console.log("uploadFile debug:", {
      hasToken: !!token,
      tokenLength: token.length,
      fileName: file.name,
      tokenPreview: token.substring(0, 20) + "...",
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
      console.log("getData token debug:", {
        tokenType: typeof token,
        tokenLength: token
          ? typeof token === "string"
            ? token.length
            : "not-a-string"
          : 0,
        isString: typeof token === "string",
        isObject: typeof token === "object",
        tokenValue:
          typeof token === "string"
            ? token.substring(0, 20)
            : String(token).substring(0, 20),
      });
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${apiUrl}${URL}`, {
      method: "GET",
      headers,
      credentials: "include",
    });

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
      console.log("putData token debug:", {
        tokenType: typeof token,
        tokenLength: token
          ? typeof token === "string"
            ? token.length
            : "not-a-string"
          : 0,
        isString: typeof token === "string",
        isObject: typeof token === "object",
        tokenValue:
          typeof token === "string"
            ? token.substring(0, 20)
            : String(token).substring(0, 20),
      });
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${apiUrl}${URL}`, {
      method: "PUT",
      headers,
      credentials: "include",
      body: JSON.stringify(formData),
    });

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
      console.log("deleteData token debug:", {
        tokenType: typeof token,
        tokenLength: token
          ? typeof token === "string"
            ? token.length
            : "not-a-string"
          : 0,
        isString: typeof token === "string",
        isObject: typeof token === "object",
        tokenValue:
          typeof token === "string"
            ? token.substring(0, 20)
            : String(token).substring(0, 20),
      });
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${apiUrl}${URL}`, {
      method: "DELETE",
      headers,
      credentials: "include",
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("deleteData error:", error);
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
    const response = await fetch(`${apiUrl}/api/statistics/dashboard`, {
      method: "GET",
      headers,
      credentials: "include",
    });
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

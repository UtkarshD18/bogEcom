import Cookies from "js-cookie";

const appUrl = process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000";

const refreshAccessToken = async () => {
  try {
    const response = await fetch(`${appUrl}/api/user/refresh-token`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const token = data?.data?.accessToken || null;
    if (token) {
      Cookies.set("accessToken", token, { expires: 7 });
    }
    return token;
  } catch (error) {
    console.error("refreshAccessToken error:", error);
    return null;
  }
};

export const postData = async (URL, FormData) => {
  try {
    let response = await fetch(
      `${appUrl}${URL.startsWith("/") ? URL : "/" + URL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Cookies.get("accessToken")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(FormData),
      },
    );

    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await fetch(
          `${appUrl}${URL.startsWith("/") ? URL : "/" + URL}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${newToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(FormData),
          },
        );
      }
    }

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text
        ? { message: text, error: !response.ok }
        : { error: !response.ok };
    }

    return data;
  } catch (error) {
    console.error("postData error:", error);
    return { error: true, message: error.message };
  }
};

export const fetchDataFromApi = async (URL) => {
  try {
    let response = await fetch(
      `${appUrl}${URL.startsWith("/") ? URL : "/" + URL}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${Cookies.get("accessToken")}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await fetch(
          `${appUrl}${URL.startsWith("/") ? URL : "/" + URL}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${newToken}`,
              "Content-Type": "application/json",
            },
          },
        );
      }
    }

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text
        ? { message: text, error: !response.ok }
        : { error: !response.ok };
    }

    return data;
  } catch (error) {
    console.error("fetchDataFromApi error:", error);
    return { error: true, message: error.message };
  }
};

export const putData = async (URL, FormData) => {
  try {
    let response = await fetch(
      `${appUrl}${URL.startsWith("/") ? URL : "/" + URL}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${Cookies.get("accessToken")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(FormData),
      },
    );

    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await fetch(
          `${appUrl}${URL.startsWith("/") ? URL : "/" + URL}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${newToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(FormData),
          },
        );
      }
    }

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text
        ? { message: text, error: !response.ok }
        : { error: !response.ok };
    }

    return data;
  } catch (error) {
    console.error("putData error:", error);
    return { error: true, message: error.message };
  }
};

export const deleteData = async (URL) => {
  try {
    let response = await fetch(
      `${appUrl}${URL.startsWith("/") ? URL : "/" + URL}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${Cookies.get("accessToken")}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await fetch(
          `${appUrl}${URL.startsWith("/") ? URL : "/" + URL}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${newToken}`,
              "Content-Type": "application/json",
            },
          },
        );
      }
    }

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text
        ? { message: text, error: !response.ok }
        : { error: !response.ok };
    }

    return data;
  } catch (error) {
    console.error("deleteData error:", error);
    return { error: true, message: error.message };
  }
};

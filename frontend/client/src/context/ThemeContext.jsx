"use client";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { MyContext } from "./ThemeProvider";

const ThemeProvider = ({ children }) => {
  const [isOpenAddressBox, setIsOpenAddressBox] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [user, setUser] = useState({
    email: "",
    Password: "",
  });

  const router = useRouter();

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token !== undefined && token !== null && token !== "") {
      Cookies.remove("actionType");
      setIsLogin(true);
      setUser({
        name: Cookies.get("userName"),
        email: Cookies.get("userEmail"),
      });

      router.push("/");
    }
  }, []); // Empty dependency array - runs only on mount

  const isOpenAddressPanel = () => {
    setIsOpenAddressBox(!isOpenAddressBox);
  };

  const alertBox = (type, msg) => {
    if (type === "success") {
      toast.success(msg);
    } else {
      toast.error(msg);
    }
  };

  const values = {
    setIsOpenAddressBox,
    isOpenAddressBox,
    isOpenAddressPanel,
    alertBox,
    setIsLogin,
    isLogin,
    setUser,
    user,
  };

  return (
    <MyContext.Provider value={values}>
      {children}
      <Toaster />
    </MyContext.Provider>
  );
};
export default ThemeProvider;

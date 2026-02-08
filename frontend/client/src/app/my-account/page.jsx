"use client";
import AccountSidebar from "@/components/AccountSiderbar";
import AuthenticationMethods from "@/components/AuthenticationMethods";
import SetBackupPassword from "@/components/SetBackupPassword";
import { Button } from "@mui/material";
import TextField from "@mui/material/TextField";
import cookies from "js-cookie";
import { useEffect, useState } from "react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

const MyAccount = () => {
  const [Phone, setPhone] = useState("");
  const [userProvider, setUserProvider] = useState("local");

  // Check user provider type from cookies or user data
  useEffect(() => {
    // This would ideally come from your user context or API call
    // For now, we'll check if user has Google photo (indicates Google login)
    const userPhoto = cookies.get("userPhoto");
    const userName = cookies.get("userName");

    if (userPhoto && userName) {
      setUserProvider("google"); // Assume Google user if they have photo
    }
  }, []);

  const handleBackupPasswordSuccess = () => {
    setUserProvider("mixed"); // Update to mixed after setting backup password
  };

  return (
    <section className="bg-gray-100 py-8">
      <div className="container flex gap-5">
        <div className="w-[20%]">
          <AccountSidebar />
        </div>

        <div className="wrapper w-[75%]">
          {/* Authentication Methods Overview */}
          <AuthenticationMethods />

          {/* Backup Password Component for Google Users */}
          <SetBackupPassword
            userProvider={userProvider}
            onSuccess={handleBackupPasswordSuccess}
          />

          <div className="bg-white shadow-md rounded-md mb-5">
            <div className="p-4 flex items-center justify-between border-b-[1px] border-[rgba(0,0,0,0.2)">
              <div className="info">
                <h4 className="text-[20px] font-[500] text-gray-700">
                  My Profile
                </h4>
                <p className="text-[16px] text-gray-500">
                  All your account information in one place
                </p>
              </div>
            </div>
            <form className=" p-5">
              <div className="grid grid-cols-2 gap-5 mb-5">
                <div className="form-group">
                  <TextField
                    id="fullName"
                    label="Full Name"
                    variant="outlined"
                    size="small"
                    className="w-full"
                  />
                </div>
                <div className="form-group">
                  <TextField
                    id="email"
                    label="Email"
                    variant="outlined"
                    size="small"
                    className="w-full"
                  />
                </div>
                <div className="form-group w-full">
                  <PhoneInput
                    value={Phone}
                    onChange={(phone) => setPhone(phone)}
                  />
                </div>
              </div>
              <Button type="submit" className="btn-g px-5">
                Update Profile
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
export default MyAccount;

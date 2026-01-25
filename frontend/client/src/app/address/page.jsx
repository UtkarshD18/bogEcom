"use client";
import AccountSidebar from "@/components/AccountSiderbar";
import { MyContext } from "@/context/ThemeProvider";
import { Button } from "@mui/material";
import { useContext } from "react";
import { FiPlus } from "react-icons/fi";

import AddressBox from "./addressBox";
const Address = () => {
  const context = useContext(MyContext);

  return (
    <section className="bg-gray-100 py-8">
      <div className="container flex gap-5">
        {/* Sidebar */}
        <div className="w-[20%]">
          <AccountSidebar />
        </div>

        {/* Center Content */}
        <div className="flex-1 flex justify-center">
          <div className="bg-white shadow-md rounded-md mb-5 w-[70%]">
            <div className="p-4 flex items-center justify-between border-b border-[rgba(0,0,0,0.2)]">
              <div>
                <h4 className="text-[20px] font-[500] text-gray-700">
                  Address
                </h4>
                <p className="text-[16px] text-gray-500">
                  Manage your Addresses
                </p>
              </div>

              <Button
                variant="outlined"
                className="!capitalize !font-[600] !px-5"
                sx={{
                  borderColor: "#c1591c",
                  color: "#c1591c",
                  "&:hover": {
                    backgroundColor: "#c1591c",
                    color: "#ffffff",
                    borderColor: "#c1591c",
                  },
                }}
                onClick={() => context.isOpenAddressPanel(true)}
              >
                <FiPlus size={20} className="mr-1" />
                Add Address
              </Button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <AddressBox />
              <AddressBox />
              <AddressBox />
              <AddressBox />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Address;

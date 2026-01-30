"use client";
import AccountSidebar from "@/components/AccountSiderbar";
import AddressBox from "@/components/AddressBox";
import { Button } from "@mui/material";

const Address = () => {
  return (
    <section className="bg-gray-100 py-8">
      <div className="container flex gap-5">
        <div className="w-[20%]">
          <AccountSidebar />
        </div>

        <div className="wrapper w-[75%]">
          <div className="bg-white shadow-md rounded-md mb-5">
            <div className="p-4 flex items-center justify-between border-b-[1px] border-[rgba(0,0,0,0.2)">
              <div className="info">
                <h4 className="text-[20px] font-[500] text-gray-700">
                  My Addresses
                </h4>
                <p className="text-[16px] text-gray-500">Manage your addresses</p>
              </div>
              <Button className="btn-g px-5">Add New Address</Button>
            </div>
            <div className=" p-5 grid grid-cols-3 gap-5">
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

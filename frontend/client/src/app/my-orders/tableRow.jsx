"use client";
import { Button } from "@mui/material";
import { useState } from "react";
import { FaAngleDown } from "react-icons/fa6";
import { MdDateRange } from "react-icons/md";
const OrderRow = () => {
  const [expendIndex, setExpendIndex] = useState(false);
  return (
    <>
      <tr className="border-b-[1px] border-[rgba(0,0,0,0.1)] hover:bg-gray-50">
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 font-bold">
          <Button
            className="!min-w-[40px] !h-[40px] !w-[40px] !rounded-full !text-gray-500 !bg-gray-100 hover:!bg-gray-200"
            onClick={() => setExpendIndex(!expendIndex)}
          >
            <FaAngleDown
              size={20}
              className={`transition-all ${expendIndex == true && "rotate-180"}`}
            />
          </Button>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 font-bold">
          #3413
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className="flex items-center gap-3 w-[300px]">
            <div className="rounded-full w-[50px] h-[50px] overflow-hidden">
              <img src={"/Profile1.png"} alt="image" />
            </div>

            <div className="info flex flex-col gap-0">
              <span className="text-gray-800 text-[14px]">Mr. Raju</span>
              <span className="text-gray-500 text-[14px]">
                august17@gmail.com
              </span>
            </div>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 whitespace-nowrap">
          pay_RLSUjirStvN9Zu
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 whitespace-nowrap">
          +91 7989798765
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <div className=" w-[350px] py-3">
            <span className="bg-gray-100 rounded-md px-2 py-1 border borded-[rgba(0,0,0,0.1)] ">
              Home
            </span>
            <p className="pt-2">H No 22 Street No 6 Adarsh Mohalla Delhi</p>
          </div>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          110053
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">₹540</td>
        <td className="text-[14px] text-gray-600 px-4 py-2 whitespace-nowrap text-primary font-bold">
          67ced89ec6f34fsc
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2">
          <span className="px-4 py-1 bg-emerald-500 text-white rounded-full text-xs font-semibold ">
            confirm
          </span>
        </td>
        <td className="text-[14px] text-gray-600 font-[500] px-4 py-2 whitespace-nowrap flex items-center">
          <div className="flex items-center gap-1">
            <MdDateRange size={20} /> 2026-1-31
          </div>
        </td>
      </tr>
      {expendIndex === true && (
        <tr className="bg-gray-100">
          <td colSpan={3} className="p-5 ">
            <div className="flex items-center gap-3">
              <div className="img rounded-md overflow-hidden w-[80px] h-[80px]">
                <img
                  src={"/pfp2.png"}
                  alt="image"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="info flex flex-col">
                <h2 className="text-gray-900 text-[15px] font-[500]">
                  Peanut Butter
                </h2>
                <span className="text-gray-600 text-[13px] font-[500]">
                  Protein
                </span>
                <span className="text-gray-600 text-[13px] font-[500]">
                  Unit Price: ₹540.00
                </span>
              </div>
            </div>
          </td>
          <td colSpan={1} className="p-5">
            X2
          </td>
          <td colSpan={1} className="p-5">
            <span className="text-gray-950 font-[500] ">₹1080.00</span>
          </td>
          <td colSpan={1} className="p-5"></td>
          <td colSpan={1} className="p-5"></td>
          <td colSpan={1} className="p-5"></td>
          <td colSpan={1} className="p-5"></td>
          <td colSpan={1} className="p-5"></td>
          <td colSpan={1} className="p-5"></td>
        </tr>
      )}
    </>
  );
};
export default OrderRow;

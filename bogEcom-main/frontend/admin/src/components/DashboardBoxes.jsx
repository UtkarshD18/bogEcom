"use client";
import Link from "next/link";
import { GoGift } from "react-icons/go";
import { LiaProductHunt } from "react-icons/lia";
import { MdOutlineCategory } from "react-icons/md";
import { TbUsers } from "react-icons/tb";

const Box = ({ title, count, icon, bg, link }) => {
  return (
    <Link href={link || "#"}>
      <div
        className={`${bg} rounded-lg shadow-md p-6 text-white cursor-pointer transition-transform duration-300 hover:shadow-lg hover:scale-105`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-90">{title}</p>
            <h3 className="text-3xl font-bold mt-2">{count}</h3>
          </div>
          <div className="opacity-80">{icon}</div>
        </div>
      </div>
    </Link>
  );
};

const DashboardBoxes = ({ stats = {} }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <Box
        title="Total Users"
        count={stats.users || "0"}
        icon={<TbUsers size={40} className="text-white" />}
        bg="bg-gradient-to-br from-emerald-500 to-teal-600"
        link="/users"
      />

      <Box
        title="Total Orders"
        count={stats.orders || "0"}
        icon={<GoGift size={40} className="text-white" />}
        bg="bg-gradient-to-br from-blue-500 to-cyan-600"
        link="/orders"
      />

      <Box
        title="Total Products"
        count={stats.products || "0"}
        icon={<LiaProductHunt size={40} className="text-white" />}
        bg="bg-gradient-to-br from-purple-500 to-indigo-600"
        link="/products-list"
      />

      <Box
        title="Total Categories"
        count={stats.categories || "0"}
        icon={<MdOutlineCategory size={40} className="text-white" />}
        bg="bg-gradient-to-br from-pink-500 to-rose-600"
        link="/category-list"
      />
    </div>
  );
};

export default DashboardBoxes;

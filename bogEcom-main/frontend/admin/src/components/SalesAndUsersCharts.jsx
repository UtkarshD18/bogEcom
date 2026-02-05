"use client";
import { Button } from "@mui/material";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const salesData = [
  { name: "JAN", sales: 124 },
  { name: "FEB", sales: 230 },
  { name: "MAR", sales: 432 },
  { name: "APR", sales: 312 },
  { name: "MAY", sales: 453 },
  { name: "JUN", sales: 323 },
  { name: "JUL", sales: 652 },
  { name: "AUG", sales: 476 },
  { name: "SEP", sales: 436 },
  { name: "OCT", sales: 566 },
  { name: "NOV", sales: 324 },
  { name: "DEC", sales: 332 },
];

const usersData = [
  { name: "JAN", users: 14 },
  { name: "FEB", users: 30 },
  { name: "MAR", users: 42 },
  { name: "APR", users: 12 },
  { name: "MAY", users: 53 },
  { name: "JUN", users: 33 },
  { name: "JUL", users: 52 },
  { name: "AUG", users: 46 },
  { name: "SEP", users: 46 },
  { name: "OCT", users: 56 },
  { name: "NOV", users: 34 },
  { name: "DEC", users: 32 },
];

export const SalesAndUsersCharts = () => {
  const [isActiveChart, setIsActiveChart] = useState(0);

  return (
    <div className="bg-white p-5 rounded-md shadow-md mt-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-[18px] text-gray-700 font-[600]">
          Total Users & Total Sales
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="text"
            className={`!capitalize !font-bold ${
              isActiveChart === 0 ? "!text-green-600" : "!text-gray-500"
            }`}
            onClick={() => setIsActiveChart(0)}
          >
            Total Sales
          </Button>
          <Button
            variant="text"
            className={`!capitalize !font-bold ${
              isActiveChart === 1 ? "!text-blue-600" : "!text-gray-500"
            }`}
            onClick={() => setIsActiveChart(1)}
          >
            Total Users
          </Button>
        </div>
      </div>

      <div className="w-full mt-5" style={{ height: "400px" }}>
        <ResponsiveContainer width="100%" height="100%">
          {isActiveChart === 0 ? (
            <AreaChart
              data={salesData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#02B290"
                fill="#5ff4d6"
              />
            </AreaChart>
          ) : (
            <AreaChart
              data={usersData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="users"
                stroke="#3B82F6"
                fill="#93C5FD"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesAndUsersCharts;

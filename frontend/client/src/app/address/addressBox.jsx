"use client";
import { Button } from "@mui/material";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { HiOutlineDotsVertical } from "react-icons/hi";
const AddressBox = () => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div className="addressBox w-full p-4 bg-[#fafafa] rounded-md border border-[rgba(0,0,0,0.1)] flex items-center justify-between">
      <div className="info w-[80%] ">
        <span className="inline-block bg-gray-200 text-[14px] p-2 py-1 rouned-md">
          Home
        </span>
        <h3 className="py-1 text-[18px] text-gray-700 font-[500]">
          Utkarsh Dwivedi +91-9983135243
        </h3>
        <p className="text-[14px] text-gray-600">
          H no2 Street No6 Adarsh mohalla delhi 110053
        </p>
      </div>
      <div className="action relative">
        <Button
          className="!w-[50px] !h-[50px] !min-w-[50px] !rounded-full !p-0 text-gray-700"
          onClick={handleClick}
        >
          <HiOutlineDotsVertical size={25} />
        </Button>
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          slotProps={{
            list: {
              "aria-labelledby": "basic-button",
            },
          }}
        >
          <MenuItem onClick={handleClose}>Edit</MenuItem>
          <MenuItem onClick={handleClose}>Delete</MenuItem>
        </Menu>
      </div>
    </div>
  );
};
export default AddressBox;

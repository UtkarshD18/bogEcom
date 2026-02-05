"use client";
import { InputAdornment, TextField } from "@mui/material";
import { FiSearch } from "react-icons/fi";

const Search = ({ value, onChange, placeholder }) => (
  <TextField
    variant="outlined"
    size="small"
    value={value}
    onChange={onChange}
    placeholder={placeholder || "Search..."}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <FiSearch />
        </InputAdornment>
      ),
    }}
    fullWidth
  />
);

export default Search;

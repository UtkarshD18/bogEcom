"use client";
import { Button } from "@mui/material";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import React from "react";

const label = { slotProps: { input: { "aria-label": "Checkbox demo" } } };

const columns = [
  { id: "ID", label: "ID", minWidth: 40 },
  { id: "USER", label: "USER", minWidth: 300 },
  { id: "PHONE NUMBER", label: "PHONE NUMBER", minWidth: 100 },
  { id: "CREATED AT", label: "CREATED AT", minWidth: 100 },
  { id: "ACTIONS", label: "ACTIONS", minWidth: 200 },
];

const UsersComponent = () => {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  return (
    <section className="w-full">
      <div className="w-full p-4 rounded-md shadow-md bg-white mt-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Users</h2>
          <Button variant="contained" color="primary">
            Add User
          </Button>
        </div>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    style={{ minWidth: column.minWidth }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>{/* Map user data here */}</TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={0}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </div>
    </section>
  );
};

export default UsersComponent;

import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import UserModel from "../models/user.model.js";

let ioInstance = null;

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

export const initSocket = (httpServer, { origins = [], jwtSecret } = {}) => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    cors: {
      origin: origins,
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    const cookies = parseCookies(socket.handshake.headers?.cookie || "");
    const token =
      cookies.accessToken ||
      cookies.token ||
      socket.handshake.auth?.token ||
      null;

    if (!token || !jwtSecret) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (decoded?.id) {
        socket.userId = decoded.id;
      }
    } catch {
      // Treat invalid/expired auth as a guest connection.
    }
    return next();
  });

  ioInstance.on("connection", async (socket) => {
    socket.join("audience:all");

    if (socket.userId) {
      socket.join("audience:user");
      socket.join(`user:${socket.userId}`);
      try {
        const user = await UserModel.findById(socket.userId).select("role status");
        if (user?.role === "Admin" && user?.status === "active") {
          socket.join("admin:orders");
          socket.join("admin:analytics");
        }
      } catch {
        // Ignore role lookup failures for socket connections.
      }
      return;
    }

    socket.join("audience:guest");
  });

  return ioInstance;
};

export const getIO = () => ioInstance;

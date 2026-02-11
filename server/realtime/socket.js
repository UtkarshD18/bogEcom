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

    if (!token) {
      return next(new Error("UNAUTHORIZED"));
    }

    if (!jwtSecret) {
      return next(new Error("AUTH_NOT_CONFIGURED"));
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (!decoded?.id) {
        return next(new Error("INVALID_TOKEN"));
      }
      socket.userId = decoded.id;
      return next();
    } catch (error) {
      return next(new Error("INVALID_TOKEN"));
    }
  });

  ioInstance.on("connection", async (socket) => {
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      try {
        const user = await UserModel.findById(socket.userId).select("role status");
        if (user?.role === "Admin" && user?.status === "active") {
          socket.join("admin:orders");
        }
      } catch {
        // Ignore role lookup failures for socket connections.
      }
    }
  });

  return ioInstance;
};

export const getIO = () => ioInstance;

import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
};

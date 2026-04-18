import { Request, Response, NextFunction } from "express"
import { AppError } from "../util/errors.js"

export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (process.env["NODE_ENV"] !== "test") {
        console.error("Error:", err);
    }

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message
        });
        return;
    }

    res.status(500).json({
        error: "Internal Server Error",
        message: process.env["NODE_ENV"] === "production" ?
            "An unexpected error has occurred"
            :
            err.message
    });
}
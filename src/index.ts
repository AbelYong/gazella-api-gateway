import "dotenv/config";
import express from "express";
import session from "express-session";
import * as oidc from "openid-client";
import { globalErrorHandler } from "./handlers/error_handler.js";
import { asyncHandler } from "./handlers/async_handler.js";
import { exchangeTokens, startPKCE } from "./controllers/auth_controller.js";
import { validateRequest } from "./validators/request_validator.js";
import { pkceExchangeSchema } from "./schemas/auth_schema.js";

const app = express();
const PORT = process.env["PORT"] || 4000;

app.use(session({
    secret: process.env["TOKEN_SIGNATURE"] || "",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env["NODE_ENV"] === "production",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

let oidcConfig: oidc.Configuration;

async function initOIDC() {
    let issuerUrlAux = process.env["IDP_ISSUER_URL"] || "http://localhost:3000/oidc"
    const issuerUrl = new URL(issuerUrlAux);
    
    oidcConfig = await oidc.discovery(
        issuerUrl,
        process.env["IDP_CLIENT_NAME"] || "",
        process.env["IDP_CLIENT_SECRET"] || "",
        undefined,
        {
            execute: [oidc.allowInsecureRequests] 
        }
    );
    
    console.log("Completed OIDC provider discovery. IdP is ready to accept request.");
}

async function startGateway() {
    await initOIDC();

    app.get("/api/login", asyncHandler(startPKCE(oidcConfig)));

    app.get("/api/callback", validateRequest(pkceExchangeSchema), asyncHandler(exchangeTokens(oidcConfig)));
    
    app.use(globalErrorHandler);

    app.listen(PORT, () => {
        console.log(`API Gateway listening on http://localhost:${PORT}`);
        console.log(`To test the flow go to: http://localhost:${PORT}/api/login`);
    });
}

await startGateway();

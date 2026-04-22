import express from "express";
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env["PORT"] || 4000;

interface ServiceConfig {
    target: string;
    paths: string[];
    rewritePrefix?: string; 
}

const services: Record<string, ServiceConfig> = {
    identityProvider: {
        target: process.env["AUTH_SERVICE_URL"] || "http://idp-app:3000",
        paths: ['/oidc', '/api/auth/interaction']
    }
};

for (const [serviceName, config] of Object.entries(services)) {
    
    const proxyOptions: Options = {
        target: config.target,
        changeOrigin: true,
        xfwd: true,
        pathFilter: config.paths,
        
        ...(config.rewritePrefix && {
            pathRewrite: {
                [`^${config.rewritePrefix}`]: '', 
            }
        }),

        on: {
            error: (err, req, res) => {
                console.error(`[${serviceName}] Falló la conexión en ${config.target}:`, err.message);
                const expressRes = res as express.Response;
                if (!expressRes.headersSent) {
                    expressRes.status(502).json({ error: `${serviceName} Service unavailable or Bad Gateway` });
                }
            }
        }
    };

    app.use(createProxyMiddleware(proxyOptions));
}

app.listen(PORT, () => {
    console.log(`Gazella API Gateway listening on http://localhost:${PORT}`);
});

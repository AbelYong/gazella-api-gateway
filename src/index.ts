import express from "express";
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.disable("x-powered-by");

const PORT = process.env["PORT"] || 4000;

interface ServiceConfig {
    target: string;
    paths: string[];
    rewritePrefix?: string; 
}

const services: Record<string, ServiceConfig> = {
    identityProvider: {
        target: process.env["AUTH_SERVICE_URL"] || "http://localhost:3000",
        paths: ["/oidc", "/api/auth/"]
    },
    accountService: {
        target: process.env["ACCOUNT_SERVICE_URL"] || "http://localhost:5000",
        paths: ["/accounts", "/socials", ]
    },
    articleService: {
        target: process.env["ARTICLE_SERVICE_URL"] || "http://localhost:7000",
        paths: [
            "/articles/articles",
            "/articles/categories",
            "/articles/drafts",
            "/articles/my-articles",
            "/articles/to-review-articles",
            "/articles/reviews",
            "/articles/comments",
            "/articles/likes",
            "/articles/search",
            "/articles/publications"
        ],
        rewritePrefix: "/articles"
    },
    projectService: {
        target: process.env["PROJECT_SERVICE_URL"] || "http://project-service:7100",
        paths: [
            "/projects",
            "/my-projects",
            "/my-enrollments"
        ]
    },
    mediaService: {
        target: process.env["MEDIA_SERVICE_URL"] || "http://localhost:8000",
        paths: ["/media"]
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
            error: (err, _req, res) => {
                console.error(`[${serviceName}] Failed to connect at: ${config.target}:`, err.message);
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

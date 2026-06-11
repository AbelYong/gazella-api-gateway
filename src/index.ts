import express from "express";
import { createProxyMiddleware, Options, responseInterceptor } from 'http-proxy-middleware';
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.disable("x-powered-by");

const PORT = process.env["PORT"] || 4000;
const HOST = process.env["HOST"] || "localhost";
const useSecureCookies = process.env["COOKIE_SECURE"] === "true";

function rewriteCookie(cookie: string): string {
    if (useSecureCookies) {
        let rewritten = cookie.replace(/SameSite=(Lax|Strict)/i, "SameSite=None");
        if (!/;\s*Secure/i.test(rewritten)) {
            rewritten += "; Secure";
        }
        return rewritten;
    }

    return cookie
        .replace(/;\s*Secure/ig, "")
        .replace(/SameSite=None/i, "SameSite=Lax");
}

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', 'file://', 'devtools://'], 
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
}));

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
        })
    };

    if (serviceName === 'identityProvider') {
        proxyOptions.selfHandleResponse = true;

        proxyOptions.on = {
            proxyRes: responseInterceptor(async (responseBuffer, proxyRes, _req, res) => {
                const locHeader = proxyRes.headers.location;
                const location = Array.isArray(locHeader) ? locHeader[0] : locHeader;

                Object.entries(proxyRes.headers).forEach(([key, value]) => {
                    if (value !== undefined) {
                        res.setHeader(key, value);
                    }
                });

                const cookies = proxyRes.headers['set-cookie'];
                if (cookies) {
                    const rewrittenCookies = cookies.map(rewriteCookie);
                    res.setHeader('set-cookie', rewrittenCookies);
                }

                if (proxyRes.statusCode === 302 || proxyRes.statusCode === 303) {
                    if (location) {
                        if (location.startsWith('com.gazella.client://')) {
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.removeHeader('location');
                            
                            return Buffer.from(JSON.stringify({ customRedirectUrl: location }));
                        }

                        const gatewayUrl = `http://${HOST}:${PORT}`;
                        if (location.startsWith(gatewayUrl)) {
                            res.setHeader('location', location.replace(gatewayUrl, ''));
                        }
                    }
                }

                res.statusCode = proxyRes.statusCode || 200;
                return responseBuffer;
            }) as any
        };
    } else {
        proxyOptions.on = {
            proxyRes: (proxyRes, _req, res) => {
                const cookies = proxyRes.headers['set-cookie'];
                if (cookies) {
                    const rewrittenCookies = cookies.map(rewriteCookie);
                    res.setHeader('set-cookie', rewrittenCookies);
                }
            }
        };
    }

    app.use(createProxyMiddleware(proxyOptions));
}

app.listen(PORT, () => {
    console.log(`Gazella API Gateway listening on http://${HOST}:${PORT}`);
});

import { Request, Response } from "express";
import * as oidc from "openid-client";
import * as jose from "jose";
import { PKCEExchangePayload } from "../schemas/auth_schema.js";
import { AppError } from "../util/errors.js";

export const startPKCE = (oidcConfig: oidc.Configuration) => 
    async (req: Request, res: Response): Promise<void> => {
        const code_verifier = oidc.randomPKCECodeVerifier();
        const code_challenge = await oidc.calculatePKCECodeChallenge(code_verifier);
        const state = oidc.randomState();
        
        req.session.code_verifier = code_verifier;
        req.session.state = state;

        const authorizationUrl = oidc.buildAuthorizationUrl(oidcConfig, {
            redirect_uri: `http://localhost:${process.env["PORT"]}/api/callback`,
            scope: "openid email account",
            code_challenge,
            code_challenge_method: "S256",
            state,
        });

        res.redirect(authorizationUrl.href);
    }

export const exchangeTokens = (oidcConfig: oidc.Configuration) =>
    async (req: Request<{}, {}, PKCEExchangePayload>, res: Response): Promise<void> => {
        const { code_verifier, state } = req.session;

        if (!code_verifier || !state) {
            throw new AppError(400, "code_verifier or state not found in session. It might have expired or the interaction is invalid")
        }

        const currentUrl = new URL(req.protocol + "://" + req.get("host") + req.originalUrl);
        
        const tokenSet = await oidc.authorizationCodeGrant(
            oidcConfig, 
            currentUrl, 
            {
                pkceCodeVerifier: code_verifier,
                expectedState: state,
                idTokenExpected: true
            }
        );

        req.session.tokenSet = tokenSet;
        
        delete req.session.code_verifier;
        delete req.session.state;

        const idTokenClaims = tokenSet.id_token ? jose.decodeJwt(tokenSet.id_token) : null;

        res.json({
            message: "Successful login",
            account: idTokenClaims?.["email"],
            roles: idTokenClaims?.["roles"]
        });
    }

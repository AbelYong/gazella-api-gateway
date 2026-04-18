import "express-session";

declare module "express-session" {
    interface SessionData {
        code_verifier?: string;
        state?: string;
        tokenSet?: any;
    }
}
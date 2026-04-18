import { z } from "zod"

const urlSafeRegex = /^[a-zA-Z0-9\-._~]+$/;

export const pkceExchangeSchema = z.object({
    session: z.object({
        code_verifier: z.string({ error: "code_verifier has the wrong format" })
            .min(43, { error: "Code verifier must at least be of 43 characters length" })
            .max(128, {error: "code_verifier cannot exceed 128 characters length" })
            .regex(urlSafeRegex, { error: "code_verifier may only have letters, numbers and the characters: '-', '.', '_', '~'" }),
        
        state: z.string({error: "state has the wrong format"})
            .min(16, { error: "The state is too short, at least 16 characters are needed for security" })
            .max(1024, {error: "The state exceeds the maximum length of 1024 characters"} )
            .regex(urlSafeRegex, {error: "state may only have letters, numbers and the characters: '-', '.', '_', '~'"})
    })
});

export type PKCEExchangePayload = z.infer<typeof pkceExchangeSchema>["session"];

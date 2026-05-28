import { createAuthClient } from "better-auth/react"
import { customSessionClient } from "better-auth/client/plugins"
import type { auth } from "./auth"

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : undefined),
    plugins: [
        customSessionClient<typeof auth>()
    ]
})


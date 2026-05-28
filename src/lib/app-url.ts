/** Canonical public app origin for links in emails and auth redirects. */
export function getAppBaseUrl(): string {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.BETTER_AUTH_URL ||
        'http://localhost:3000'
    ).replace(/\/$/, '');
}

export function getPasswordResetRedirectUrl(): string {
    return `${getAppBaseUrl()}/auth/reset-password`;
}

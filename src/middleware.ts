import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: ['/:orgSlug((?!api|_next|static|favicon.ico|uploads).*)/:path*', '/api/orgs/:path*', '/api/events/:path*', '/api/forms/:path*', '/api/register', '/api/public/:path*'],
};

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                role: {
                    include: {
                        permissions: true
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Flatten permissions
        const permissions = user.role?.permissions.map(p => p.name) || [];

        const su = session.user as Record<string, unknown>;

        return NextResponse.json({
            user: {
                ...session.user,
                role: user.role?.name,
                permissions,
                isPlatformSuperAdmin: su.isPlatformSuperAdmin ?? false,
                activeOrganizationId: su.activeOrganizationId ?? null,
                activeOrganizationSlug: su.activeOrganizationSlug ?? null,
                orgRole: su.orgRole ?? null,
                orgPermissions: su.orgPermissions ?? [],
            }
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { customSession } from "better-auth/plugins";
import { ALL_ORG_PERMISSIONS } from "./org-permissions";
import {
    hasPlatformElevatedAccess,
    hasStrictPlatformSuperAdminAccess,
} from "./platform-app-role";

export const auth = betterAuth({
    baseURL:
        process.env.BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_BASE_URL,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url }) => {
            const { sendPasswordResetEmail } = await import('./emailService');
            const {
                consumePasswordResetEmailContext,
                resolvePasswordResetEmailContext,
            } = await import('./password-reset');
            const pending = consumePasswordResetEmailContext(user.email);
            const ctx = pending
                ? await resolvePasswordResetEmailContext(user.id, pending.organizationId).then(
                      (resolved) => ({
                          ...resolved,
                          eventId: pending.eventId ?? resolved.eventId,
                      })
                  )
                : await resolvePasswordResetEmailContext(user.id);
            void sendPasswordResetEmail(user.email, url, {
                userName: user.name ?? undefined,
                organizationId: ctx.organizationId ? ctx.organizationId : null,
                eventId: ctx.eventId,
                organizationName: ctx.organizationName,
            });
        },
    },
    secret: process.env.BETTER_AUTH_SECRET,
    user: {
        additionalFields: {
            roleId: {
                type: "string",
                required: false,
                input: false
            },
            isPlatformSuperAdmin: {
                type: "boolean",
                required: false,
                input: false,
            }
        }
    },
    session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 days
        updateAge: 60 * 60 * 24, // 1 day
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60 // 5 minutes
        }
    },
    rateLimit: {
        enabled: false,
    },

    plugins: [

        customSession(async ({ user, session }) => {
            const userWithRole = await prisma.user.findUnique({
                where: { id: user.id },
                include: {
                    role: {
                        include: {
                            permissions: true
                        }
                    },
                    activeOrganizationPref: {
                        include: { organization: true },
                    },
                }
            });

            const legacyPermissions = userWithRole?.role?.permissions.map(p => p.name) || [];
            const legacyRole = userWithRole?.role?.name;
            const isPlatformElevated = hasPlatformElevatedAccess(
                userWithRole?.isPlatformSuperAdmin,
                legacyRole
            );
            const platformSuperAdminFlag = Boolean(userWithRole?.isPlatformSuperAdmin);
            const isPlatformSuperAdmin = hasStrictPlatformSuperAdminAccess(
                platformSuperAdminFlag,
                legacyRole
            );
            const canViewPlatformFeedback = platformSuperAdminFlag;

            const activeOrgId = userWithRole?.activeOrganizationPref?.organizationId ?? null;
            const activeOrgSlug = userWithRole?.activeOrganizationPref?.organization?.slug ?? null;

            let orgRole: string | null = null;
            let orgPermissions: string[] = [];

            if (activeOrgId) {
                const member = await prisma.organizationMember.findUnique({
                    where: {
                        organizationId_userId: {
                            organizationId: activeOrgId,
                            userId: user.id,
                        },
                    },
                });
                if (member) {
                    orgRole = member.role;
                    orgPermissions =
                        member.permissions.length > 0
                            ? member.permissions
                            : member.role === "OWNER" || member.role === "ADMIN"
                              ? ALL_ORG_PERMISSIONS
                              : [];
                }
            }

            // Platform Admin / Super Admin: keep legacy app permissions even when org membership is narrow (e.g. STAFF).
            const effectivePermissions = (() => {
                if (isPlatformElevated) {
                    const fromOrg =
                        activeOrgId && orgPermissions.length > 0 ? orgPermissions : [];
                    if (fromOrg.length === 0) return legacyPermissions;
                    return Array.from(new Set([...legacyPermissions, ...fromOrg]));
                }
                if (activeOrgId && orgPermissions.length > 0) return orgPermissions;
                return legacyPermissions;
            })();

            const effectiveRole =
                activeOrgId && orgRole ? orgRole : legacyRole;

            return {
                user: {
                    ...user,
                    isPlatformSuperAdmin,
                    canViewPlatformFeedback,
                    role: effectiveRole,
                    permissions: effectivePermissions,
                    legacyRole,
                    legacyPermissions,
                    activeOrganizationId: activeOrgId,
                    activeOrganizationSlug: activeOrgSlug,
                    orgRole,
                    orgPermissions,
                },
                session
            };
        })
    ]
});

import type { FormField } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getDefaultRegistrationFormIdFromSettings } from '@/lib/org-settings';

type FormWithFields = { id: string; fields: FormField[] };

/**
 * When an event's linked form has no fields (misconfigured or new empty form), use the
 * organization's default registration form fields for display and validation so
 * internal and public registration still match the org template.
 */
export async function resolveEffectiveRegistrationFields(
    organizationId: string,
    orgSettings: unknown,
    registrationForm: FormWithFields
): Promise<FormField[]> {
    if (registrationForm.fields.length > 0) {
        return registrationForm.fields;
    }
    const defaultId = getDefaultRegistrationFormIdFromSettings(orgSettings);
    if (!defaultId || defaultId === registrationForm.id) {
        return registrationForm.fields;
    }
    const template = await prisma.form.findFirst({
        where: { id: defaultId, organizationId },
        include: { fields: { orderBy: { order: 'asc' } } },
    });
    return template?.fields?.length ? template.fields : registrationForm.fields;
}

import { z } from 'zod';
import type { FormField } from '@prisma/client';
import { FormFieldType } from '@prisma/client';

export function buildDynamicSchema(fields: FormField[]) {
    const shape: Record<string, z.ZodTypeAny> = {};

    const sorted = [...fields].sort((a, b) => a.order - b.order);

    for (const f of sorted) {
        let fieldSchema: z.ZodTypeAny;

        switch (f.type) {
            case FormFieldType.TEXT:
            case FormFieldType.TEXTAREA:
            case FormFieldType.PHONE:
                fieldSchema = z.string();
                break;
            case FormFieldType.EMAIL:
                fieldSchema = z.string().email();
                break;
            case FormFieldType.NUMBER:
                fieldSchema = z.coerce.number();
                break;
            case FormFieldType.DATE:
            case FormFieldType.DATETIME:
                fieldSchema = z.string();
                break;
            case FormFieldType.CHECKBOX:
                fieldSchema = z.boolean();
                break;
            case FormFieldType.SELECT:
            case FormFieldType.RADIO:
                fieldSchema = z.string();
                break;
            case FormFieldType.MULTI_SELECT:
                fieldSchema = z.array(z.string());
                break;
            case FormFieldType.FILE:
            case FormFieldType.HIDDEN:
                fieldSchema = z.union([z.string(), z.any()]);
                break;
            default:
                fieldSchema = z.unknown();
        }

        const validation = f.validation as { min?: number; max?: number; regex?: string } | null;
        if (validation?.min != null && fieldSchema instanceof z.ZodString) {
            fieldSchema = fieldSchema.min(validation.min);
        }
        if (validation?.max != null && fieldSchema instanceof z.ZodString) {
            fieldSchema = fieldSchema.max(validation.max);
        }
        if (validation?.regex && fieldSchema instanceof z.ZodString) {
            fieldSchema = fieldSchema.regex(new RegExp(validation.regex));
        }

        if (!f.required) {
            fieldSchema = fieldSchema.optional();
        } else {
            if (f.type === FormFieldType.TEXT || f.type === FormFieldType.TEXTAREA || f.type === FormFieldType.PHONE) {
                fieldSchema = (fieldSchema as z.ZodString).min(1, 'Required');
            }
            if (f.type === FormFieldType.EMAIL) {
                fieldSchema = (fieldSchema as z.ZodString).min(1);
            }
        }

        shape[f.fieldKey] = fieldSchema;
    }

    return z.object(shape);
}

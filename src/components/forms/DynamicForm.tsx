'use client';

import { useForm, Controller, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FormField } from '@prisma/client';
import { FormFieldType } from '@prisma/client';
import { buildDynamicSchema } from '@/lib/forms/build-zod-schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

type Props = {
    fields: FormField[];
    locale?: string;
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
    submitLabel?: string;
};

function resolveLabel(field: FormField, locale: string) {
    const i18n = field.labelI18n as Record<string, string> | null;
    return i18n?.[locale] ?? field.label;
}

export function DynamicForm({ fields, locale = 'en', onSubmit, submitLabel = 'Submit' }: Props) {
    const schema = buildDynamicSchema(fields);
    const defaults: Record<string, unknown> = {};
    for (const f of fields) {
        if (f.type === FormFieldType.CHECKBOX) defaults[f.fieldKey] = false;
        else if (f.type === FormFieldType.MULTI_SELECT) defaults[f.fieldKey] = [];
        else defaults[f.fieldKey] = '';
    }

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: defaults,
    });

    return (
        <form
            onSubmit={form.handleSubmit(async (data) => {
                await onSubmit(data as Record<string, unknown>);
            })}
            className="space-y-6 max-w-lg mx-auto"
        >
            {fields
                .sort((a, b) => a.order - b.order)
                .map((field) => (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.fieldKey}>{resolveLabel(field, locale)}</Label>
                        <DynamicFieldInput field={field} control={form.control} name={field.fieldKey} />
                        {form.formState.errors[field.fieldKey] && (
                            <p className="text-sm text-red-600">
                                {(form.formState.errors[field.fieldKey]?.message as string) || 'Invalid'}
                            </p>
                        )}
                    </div>
                ))}
            <Button type="submit" className="w-full bg-[#22C55E] hover:bg-[#1DAE50]">
                {submitLabel}
            </Button>
        </form>
    );
}

function DynamicFieldInput({
    field,
    control,
    name,
}: {
    field: FormField;
    control: Control<Record<string, unknown>>;
    name: string;
}) {
    switch (field.type) {
        case FormFieldType.TEXT:
        case FormFieldType.EMAIL:
        case FormFieldType.PHONE:
            return (
                <Controller
                    name={name}
                    control={control}
                    render={({ field: f }) => (
                        <Input {...f} value={(f.value as string) ?? ''} id={field.fieldKey} />
                    )}
                />
            );
        case FormFieldType.TEXTAREA:
            return (
                <Controller
                    name={name}
                    control={control}
                    render={({ field: f }) => (
                        <Textarea {...f} value={(f.value as string) ?? ''} id={field.fieldKey} />
                    )}
                />
            );
        case FormFieldType.NUMBER:
            return (
                <Controller
                    name={name}
                    control={control}
                    render={({ field: f }) => (
                        <Input
                            type="number"
                            {...f}
                            value={f.value === undefined || f.value === '' ? '' : String(f.value)}
                            onChange={(e) => f.onChange(e.target.value ? Number(e.target.value) : '')}
                            id={field.fieldKey}
                        />
                    )}
                />
            );
        case FormFieldType.SELECT: {
            const opts = (field.options as { value: string; label: string }[]) || [];
            return (
                <Controller
                    name={name}
                    control={control}
                    render={({ field: f }) => (
                        <Select value={(f.value as string) || ''} onValueChange={f.onChange}>
                            <SelectTrigger id={field.fieldKey}>
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {opts.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            );
        }
        case FormFieldType.RADIO: {
            const opts = (field.options as { value: string; label: string }[]) || [];
            return (
                <Controller
                    name={name}
                    control={control}
                    render={({ field: f }) => (
                        <RadioGroup value={(f.value as string) || ''} onValueChange={f.onChange}>
                            {opts.map((o) => (
                                <div key={o.value} className="flex items-center gap-2">
                                    <RadioGroupItem value={o.value} id={`${field.fieldKey}-${o.value}`} />
                                    <Label htmlFor={`${field.fieldKey}-${o.value}`}>{o.label}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )}
                />
            );
        }
        case FormFieldType.CHECKBOX:
            return (
                <Controller
                    name={name}
                    control={control}
                    render={({ field: f }) => (
                        <input
                            type="checkbox"
                            checked={Boolean(f.value)}
                            onChange={(e) => f.onChange(e.target.checked)}
                            id={field.fieldKey}
                            className="h-4 w-4"
                        />
                    )}
                />
            );
        case FormFieldType.DATE:
        case FormFieldType.DATETIME:
            return (
                <Controller
                    name={name}
                    control={control}
                    render={({ field: f }) => (
                        <Input
                            type={field.type === FormFieldType.DATETIME ? 'datetime-local' : 'date'}
                            {...f}
                            value={(f.value as string) ?? ''}
                            id={field.fieldKey}
                        />
                    )}
                />
            );
        default:
            return (
                <Controller
                    name={name}
                    control={control}
                    render={({ field: f }) => (
                        <Input {...f} value={(f.value as string) ?? ''} id={field.fieldKey} />
                    )}
                />
            );
    }
}

import { redirect } from 'next/navigation';

type Props = {
    params: Promise<{ orgSlug: string; eventSlug: string }>;
};

export default async function LegacyEventLandingPageAlias({ params }: Props) {
    const { orgSlug, eventSlug } = await params;
    redirect(`/${orgSlug}/${eventSlug}`);
}

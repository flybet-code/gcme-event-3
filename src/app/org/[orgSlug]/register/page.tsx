import { redirect } from 'next/navigation';

type Props = {
    params: Promise<{ orgSlug: string }>;
};

export default async function LegacyOrgRegisterAliasPage({ params }: Props) {
    const { orgSlug } = await params;
    redirect(`/${orgSlug}/register`);
}

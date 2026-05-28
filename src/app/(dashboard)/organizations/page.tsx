'use client';

import { useEffect, useState, useMemo } from 'react';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, LayoutGrid, List as ListIcon, Building2, Calendar as CalendarIcon, Users, ArrowRight, Activity, Filter, Image as ImageIcon, Trash2 } from 'lucide-react';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

type Org = {
    id: string;
    name: string;
    slug: string;
    settings?: any;
    _count?: {
        members: number;
        events: number;
    };
};

const beautifulGradients = [
    'from-indigo-500 to-purple-500',
    'from-teal-400 to-emerald-500',
    'from-blue-500 to-cyan-400',
    'from-rose-400 to-orange-400',
    'from-fuchsia-500 to-pink-500',
    'from-amber-400 to-yellow-500',
    'from-sky-400 to-blue-600',
    'from-violet-500 to-fuchsia-500'
];

function getGradientForSlug(slug: string) {
    const sum = slug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return beautifulGradients[sum % beautifulGradients.length];
}

export default function OrganizationsPage() {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all');
    const [isSwitching, setIsSwitching] = useState<string | null>(null);
    const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);

    const handleSelectOrg = async (org: Org) => {
        setIsSwitching(org.id);
        await fetch('/api/orgs/switch', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId: org.id }),
        });
        router.refresh();
        window.location.href = `/${org.slug}/events`;
    };

    const handleDeleteOrg = async (org: Org) => {
        const ok = confirm(`Delete organization "${org.name}"? This will remove its events, forms, and related data.`);
        if (!ok) return;
        setDeletingOrgId(org.id);
        try {
            const res = await fetch(`/api/orgs/${org.id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert((data as { error?: string }).error || 'Could not delete organization');
                return;
            }
            setOrgs((prev) => prev.filter((o) => o.id !== org.id));
        } catch {
            alert('Could not delete organization');
        } finally {
            setDeletingOrgId(null);
        }
    };

    useEffect(() => {
        if (!session?.user) return;
        fetch('/api/orgs')
            .then((r) => r.json())
            .then((d) => {
                if (d.organizations) setOrgs(d.organizations);
            });
    }, [sessionUserId]);



    const u = session?.user as { isPlatformSuperAdmin?: boolean; role?: string; legacyRole?: string } | undefined;
    const hasPlatformAccess = hasPlatformElevatedAccess(u?.isPlatformSuperAdmin, u?.legacyRole ?? u?.role);
    if (!hasPlatformAccess) {
        return <AuthGate variant="forbidden" message="Platform admin only." />;
    }

    const filteredOrgs = orgs.filter(org => {
        const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            org.slug.toLowerCase().includes(searchQuery.toLowerCase());
        
        const hasEvents = (org._count?.events || 0) > 0;
        
        let matchesTab = true;
        if (activeTab === 'active') matchesTab = hasEvents;
        if (activeTab === 'inactive') matchesTab = !hasEvents;
        
        return matchesSearch && matchesTab;
    });

    const getOrgImage = (org: Org) => {
        // Find public page image/logo from settings if it exists
        if (org.settings) {
            return org.settings.landingHeroImage || org.settings.logoUrl || null;
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Header Area */}
            <div className="bg-white border-b border-gray-100 px-8 py-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                                <Building2 className="w-8 h-8 text-blue-500" />
                                All Organizations
                            </h1>
                            <p className="text-gray-500 font-medium mt-1">Manage platform organizations and their workspaces</p>
                        </div>
                    </div>

                    {/* Filters & Tools */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
                        <div className="flex bg-gray-100/50 p-1 rounded-xl w-full sm:w-auto">
                            {(['all', 'active', 'inactive'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                                        activeTab === tab 
                                            ? 'bg-white text-blue-600 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text"
                                    placeholder="Search organizations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-gray-800"
                                />
                            </div>
                            <div className="flex items-center bg-gray-100/50 p-1 rounded-xl border border-gray-100">
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <ListIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto px-8 py-8">
                {filteredOrgs.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[32px] border border-gray-100 border-dashed">
                        <Filter className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-700">No organizations found</h3>
                        <p className="text-gray-400 mt-1">Try adjusting your search or tab filters.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredOrgs.map((org) => {
                            const img = getOrgImage(org);
                            const gradient = getGradientForSlug(org.slug);
                            const eventCount = org._count?.events || 0;
                            const memberCount = org._count?.members || 0;
                            
                            return (
                                <button onClick={() => handleSelectOrg(org)} disabled={isSwitching !== null || deletingOrgId === org.id} key={org.id} className="group flex flex-col bg-white rounded-[24px] border border-gray-100 shadow-sm hover:shadow-xl hover:border-transparent hover:-translate-y-1 transition-all overflow-hidden duration-300 text-left w-full h-full relative">
                                    {isSwitching === org.id && (
                                        <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    {deletingOrgId === org.id && (
                                        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    <div
                                        className="absolute right-3 top-3 z-40 inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white/90 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!isSwitching && deletingOrgId !== org.id) handleDeleteOrg(org);
                                        }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </div>
                                    <div className={`h-40 relative overflow-hidden bg-gradient-to-br ${gradient}`}>
                                        {/* Abstract Glass shapes purely for aesthetics */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full blur-xl -ml-5 -mb-5"></div>
                                        
                                        {/* Public Image if available */}
                                        {img ? (
                                            <div 
                                                className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-50 transition-transform duration-700 group-hover:scale-110"
                                                style={{ backgroundImage: `url(${img})` }}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-30 mix-blend-overlay">
                                                <ImageIcon className="w-16 h-16 text-white" />
                                            </div>
                                        )}
                                        
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent"></div>
                                        
                                        {/* Info overlaid on gradient/image */}
                                        <div className="absolute bottom-0 left-0 p-5 w-full">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <h3 className="text-xl font-black text-white leading-tight mb-1 truncate group-hover:text-amber-300 transition-colors">{org.name}</h3>
                                                    <span className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-lg text-white text-xs font-mono font-bold border border-white/10">
                                                        {org.slug}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4 bg-white">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1 border border-gray-100/50">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> Events</span>
                                                <span className={`text-lg font-black ${eventCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                                    {eventCount} <span className="text-xs font-semibold text-gray-400 ml-0.5">Listed</span>
                                                </span>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1 border border-gray-100/50">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3"/> Members</span>
                                                <span className="text-lg font-black text-emerald-600">
                                                    {memberCount} <span className="text-xs font-semibold text-gray-400 ml-0.5">Total</span>
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${eventCount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-300'}`}></div>
                                                <span className="text-xs font-bold text-gray-500">{eventCount > 0 ? 'Active' : 'Inactive'}</span>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${isSwitching === org.id ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-100">
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Organization</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">URL Slug</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Events</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Members</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredOrgs.map((org) => {
                                        const eventCount = org._count?.events || 0;
                                        const memberCount = org._count?.members || 0;
                                        
                                        return (
                                            <tr key={org.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradientForSlug(org.slug)} flex items-center justify-center text-white font-bold shadow-sm`}>
                                                            {org.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{org.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <code className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border border-gray-200">
                                                        {org.slug}
                                                    </code>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${eventCount > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        <CalendarIcon className="w-3 h-3" /> {eventCount} listed
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600">
                                                        <Users className="w-4 h-4 text-emerald-500" /> {memberCount}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${eventCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${eventCount > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                                                        {eventCount > 0 ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleSelectOrg(org)}
                                                        disabled={isSwitching !== null || deletingOrgId === org.id}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm disabled:opacity-50"
                                                    >
                                                        {isSwitching === org.id ? 'Loading...' : 'Manage'} <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteOrg(org)}
                                                        disabled={deletingOrgId !== null || isSwitching !== null}
                                                        className="ml-2 inline-flex items-center gap-1 px-3 py-2 border border-red-100 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition-all disabled:opacity-50"
                                                    >
                                                        {deletingOrgId === org.id ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

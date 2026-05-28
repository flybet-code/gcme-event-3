'use client';

import React from 'react';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { AdminOrgEventRegistration } from '@/components/forms/AdminOrgEventRegistration';

export default function AdminRegistrationPage() {
    return (
        <>
            <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-6 sticky top-0 z-30 flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <DashboardMobileMenuButton />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">New Registration</h1>
                        <p className="text-gray-500 text-sm">
                            Organization-scoped dynamic form for the active org and selected event
                        </p>
                    </div>
                </div>
            </header>

            <div className="p-8">
                <div className="">
                    <div className="bg-white rounded-2xl lg:rounded-[32px] shadow-sm border border-gray-100 overflow-hidden p-6 md:p-10">
                        <AdminOrgEventRegistration />
                    </div>
                </div>
            </div>
        </>
    );
}

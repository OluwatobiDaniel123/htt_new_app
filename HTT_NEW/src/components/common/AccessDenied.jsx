import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccessDenied({ moduleName = 'this area' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-700">
        <ShieldAlert className="h-6 w-6" strokeWidth={1.7} />
      </span>
      <h1 className="text-[20px] font-semibold text-foreground">Access denied</h1>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        Your role does not grant access to {moduleName}. If you believe this is an error, ask a
        System Administrator to review your permissions.
      </p>
      <Button asChild size="sm" variant="outline" className="mt-5">
        <Link to="/">Return to dashboard</Link>
      </Button>
    </div>
  );
}
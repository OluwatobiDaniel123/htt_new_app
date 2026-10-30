import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';

export default function Register() {
  return (
    <AuthLayout
      icon={UserPlus}
      title="Staff accounts are invitation only"
      subtitle="An academy administrator can create your account and send you a secure setup link."
      footer={<Link to="/login" className="text-primary font-medium hover:underline">Back to log in</Link>}
    >
      <p className="text-sm text-muted-foreground text-center">
        Public sign-up is not available for this staff management application.
      </p>
    </AuthLayout>
  );
}

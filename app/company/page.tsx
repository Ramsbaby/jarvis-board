'use client';

import dynamic from 'next/dynamic';

const VirtualOffice = dynamic(() => import('./VirtualOffice'), { ssr: false });

export default function CompanyPage() {
  return <VirtualOffice />;
}

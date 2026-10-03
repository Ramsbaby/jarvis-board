'use client';

import dynamic from 'next/dynamic';

const VirtualOffice = dynamic(() => import('./VirtualOffice'), { ssr: false });

export default function CompanyPage() {
  return (
    <>
      <h1 className="sr-only">자비스 컴퍼니 가상 오피스</h1>
      <VirtualOffice />
    </>
  );
}

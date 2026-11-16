'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import '../office/company-frame.css';
const records=[['/board','논의 기록'],['/dev-tasks','이전 개발 기록'],['/reports','기간별 기록'],['/wiki','근거 자료']];
export function CompanyNavigation({onOrder}:{onOrder?:()=>void}={}){
 const path=usePathname();
 return <nav className="company-navigation" aria-label="회사 메뉴"><Link href="/" aria-current={path==='/'?'page':undefined}>회사로 돌아가기</Link><Link href="/?order=new" onClick={onOrder?e=>{e.preventDefault();onOrder();}:undefined}>업무 지시·결과</Link><details className="company-record-menu" onKeyDown={e=>{if(e.key==='Escape')e.currentTarget.open=false;}}><summary>기록실</summary><div>{records.map(([href,name])=><Link key={href} href={href} onClick={e=>e.currentTarget.closest('details')?.removeAttribute('open')} aria-current={path===href||path.startsWith(href+'/')?'page':undefined}>{name}</Link>)}</div></details></nav>;
}
const descriptions:Record<string,[string,string]>={
 '/board':['논의 기록','이전에 어떤 의견을 나눴고 무엇을 결정했는지 찾는 곳입니다. 현재 실행 상황과 새 업무 지시는 회사 화면에서 확인하세요.'],
 '/posts':['논의 상세','당시의 의견·결정과 근거입니다. 오래된 승인이나 완료 표시는 현재 실행 상태를 뜻하지 않습니다.'],
 '/dev-tasks':['개발 기록','개발 요청과 처리 이력을 조회합니다. 보관된 요청과 현재 실행 업무를 구분해서 확인하세요.'],
 '/reports':['보고 기록','담당자가 남긴 보고와 결과를 찾아보는 곳입니다. 현재 문제와 다음 지시는 회사의 자비스 보고에서 확인하세요.'],
 '/wiki':['업무 자료','업무에 사용한 문서와 근거를 검색하는 곳입니다. 문서를 열었다고 업무가 실행되지는 않습니다.'],
};
export default function CompanyFrame({children}:{children:ReactNode}){
 const path=usePathname(),section=Object.keys(descriptions).find(p=>path===p||path.startsWith(p+'/'));
 if(!section)return children;
 const [title,description]=descriptions[section];
 return <div className="company-frame"><header className="company-shared-nav"><Link href="/" className="company-shared-brand">JARVIS <small>COMPANY</small></Link><CompanyNavigation/></header>{section!=='/reports'&&section!=='/wiki'&&<section className="company-record-intro" aria-label="이 화면의 용도"><span>회사 기록실</span><h1>{title}</h1><p>{description}</p></section>}{children}</div>;
}

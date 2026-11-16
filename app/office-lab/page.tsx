import {redirect} from 'next/navigation';
export default async function Page({searchParams}:{searchParams:Promise<{order?:string}>}){const {order}=await searchParams;redirect('/?order='+encodeURIComponent(order||'new'));}

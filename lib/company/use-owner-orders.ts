'use client';
import {startTransition,useEffect,useMemo,useState,useRef,useCallback} from 'react';
import {retainSnapshot} from './poll-snapshot';
import type {OwnerOrder} from './orders';
import {ownerOrdersProjection,orderDisplayGoal} from './order-presentation';
export function useOwnerOrders(){
 const [projects,setProjects]=useState<{id:string;blockedReason?:string}[]>([]);
 const [orders,writeOrders]=useState<OwnerOrder[]>([]),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const revision=useRef(0);
 const setOrders=useCallback((update:Parameters<typeof writeOrders>[0])=>{revision.current++;writeOrders(update);},[]);
 useEffect(()=>{let disposed=false,inFlight=false;let controller:AbortController|undefined;
  async function poll(){if(disposed||inFlight||document.hidden)return;inFlight=true;const issuedRevision=revision.current;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),10000);try{const r=await fetch('/api/command-room/orders',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('사장 지시 실행 원장 연결을 확인할 수 없습니다.');const v=await r.json();if(!Array.isArray(v.items))throw Error('실행 원장 형식을 확인할 수 없습니다.');if(!disposed){startTransition(()=>{writeOrders(previous=>revision.current===issuedRevision?retainSnapshot(previous,v.items):previous);setProjects(previous=>retainSnapshot(previous,Array.isArray(v.projects)?v.projects:[]));setError('');setLoaded(true);});}}catch(e){if(!disposed){setError(e instanceof Error?e.message:'실행 연결 확인 필요');setLoaded(true);}}finally{clearTimeout(timeout);inFlight=false;}}
  const visible=()=>{if(!document.hidden)void poll();};void poll();const timer=setInterval(()=>void poll(),2000);document.addEventListener('visibilitychange',visible);return()=>{disposed=true;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const displayOrders=useMemo(()=>orders.map(o=>({...o,goal:orderDisplayGoal(o)})),[orders]);
 const projection=useMemo(()=>ownerOrdersProjection(displayOrders,!error),[displayOrders,error]);
 return {...projection,projects,orders:displayOrders,setOrders,error,loaded};
}

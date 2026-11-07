import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
export function ArtisteSupporters({artisteId}:{artisteId:string}) {
 const [supporters,setSupporters]=useState<{display_name:string;avatar_url:string|null}[]>([]);
 useEffect(()=>{let active=true;void supabase.rpc('artiste_supporters',{p_artiste_id:artisteId}).then(({data})=>{if(active)setSupporters(data||[]);});return()=>{active=false;};},[artisteId]);
 if(!supporters.length)return null;
 return <section className="rounded-2xl border border-white/10 bg-zinc-900 p-4"><h3 className="font-bold text-white">Supporters</h3><p className="mt-1 text-xs text-zinc-400">Listeners who chose to share their verified support.</p><div className="mt-3 flex flex-wrap gap-3">{supporters.map((s,i)=><div key={i} className="flex items-center gap-2 text-xs text-zinc-300">{s.avatar_url?<img src={s.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />:<span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">{s.display_name.slice(0,1)}</span>}<div>{s.display_name}<span className="block text-[10px] font-bold text-amber-300">♥ Supporter</span></div></div>)}</div></section>;
}

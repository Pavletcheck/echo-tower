import { simulateFloor } from '../src/game/battle/floor';
import { allyFromHero } from '../src/game/battle/factory';
import { FLOORS } from '../src/data/floors';
import { HEROES_BY_ID } from '../src/data/heroes';
import type { MasterAction } from '../src/game/battle/types';
type Spec=[string,number,number];
function sq(specs:Spec[]){return specs.map(([id,star,level],i)=>allyFromHero(HEROES_BY_ID[id]!,{slot:i,star,level}));}
const hand:MasterAction[]=[{at:0.3,type:'sacrifice'},{at:1.1,type:'sacrifice'},{at:1.9,type:'sacrifice'}];
function run(f:number,specs:Spec[],h:boolean){const fl=FLOORS.find(x=>x.floor===f)!;let w=0;for(let i=0;i<30;i++){if(simulateFloor(fl,sq(specs),9000+f*100+i,h?hand:[]).outcome==='win')w++;}return Math.round(w/30*100);}
const mixed8:Spec[]=[['belquist',5,8],['thorn',3,8],['neya',3,8],['grom',3,8],['lissa',3,8]];
const mixed15:Spec[]=[['belquist',5,15],['thorn',3,15],['neya',3,15],['grom',3,15],['lissa',3,15]];
const starter15:Spec[]=[['thorn',3,15],['neya',3,15],['grom',3,15],['lissa',3,15],['zip',3,15]];
const starter20:Spec[]=[['thorn',3,20],['neya',3,20],['grom',3,20],['lissa',3,20],['zip',3,20]];
for(const [name,specs] of [['mixed 5*+3* 8',mixed8],['mixed 5*+3* 15',mixed15],['starter 3* 15',starter15],['starter 3* 20',starter20]] as Array<[string,Spec[]]>){
 console.log(name);
 for(const f of [10,11,12,13,14,15,16,17,18,20,25]) console.log(` f${f} none ${run(f,specs,false)}% hand ${run(f,specs,true)}%`);
}

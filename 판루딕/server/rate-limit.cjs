// Authenticated clients never share a rate bucket merely because of a proxy address.
class RateLimit{
 constructor(now=()=>Date.now(),{windowMs=60000,maxKeys=16000}={}){this.now=now;this.windowMs=windowMs;this.maxKeys=maxKeys;this.entries=new Map();this.lastSweep=0;}
 sweep(){const now=this.now();for(const[k,v]of this.entries)if(v.until<=now)this.entries.delete(k);this.lastSweep=now;}
 take(key,limit){const now=this.now();if(now-this.lastSweep>=this.windowMs||this.entries.size>=this.maxKeys)this.sweep();let entry=this.entries.get(key);if(!entry||entry.until<=now){if(this.entries.size>=this.maxKeys)return{ok:false,retryAfter:1};entry={n:0,until:now+this.windowMs};this.entries.set(key,entry);}if(++entry.n>limit)return{ok:false,retryAfter:Math.max(1,Math.ceil((entry.until-now)/1000))};return{ok:true,retryAfter:0};}
}
module.exports={RateLimit};

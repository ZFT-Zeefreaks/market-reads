// Offline, rule-based US session calendar. Exceptional exchange closures fail
// closed as unexplained gaps; update this adapter when an approved calendar is available.
const day=(year,month,date)=>new Date(Date.UTC(year,month-1,date)).toISOString().slice(0,10);
function observed(y,m,d){const t=new Date(day(y,m,d)+'T00:00Z');if(t.getUTCDay()===0)t.setUTCDate(t.getUTCDate()+1);if(t.getUTCDay()===6)t.setUTCDate(t.getUTCDate()-1);return t.toISOString().slice(0,10);}
function nth(y,m,w,n){const first=new Date(day(y,m,1)+'T00:00Z').getUTCDay();return day(y,m,1+(w-first+7)%7+7*(n-1));}
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),date=(h+l-7*m+114)%31+1;return Date.parse(day(y,month,date)+'T00:00Z');}
export function isSession(date,id){
  const t=new Date(date+'T00:00Z'),w=t.getUTCDay(),y=t.getUTCFullYear();if(w===0||w===6)return false;
  const goodFriday=new Date(easter(y)-2*86400000).toISOString().slice(0,10);
  const holidays=new Set([observed(y,1,1),observed(y+1,1,1),observed(y,12,25),goodFriday]);
  if(id!=='gold'){
    const memorial=new Date(Date.UTC(y,5,0));while(memorial.getUTCDay()!==1)memorial.setUTCDate(memorial.getUTCDate()-1);
    [nth(y,1,1,3),nth(y,2,1,3),memorial.toISOString().slice(0,10),observed(y,7,4),nth(y,9,1,1),nth(y,11,4,4),...(y>=2022?[observed(y,6,19)]:[])].forEach(x=>holidays.add(x));
  }
  return !holidays.has(date);
}

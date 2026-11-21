import F from'node:fs';let{MAKEFUN_INPUT_DIR:I='/input',MAKEFUN_OUTPUT_DIR:O='/output'}=process.env,S=t=>{
let T=t.replace(/\n/g,''),w=t.indexOf('\n'),B=[],P;[...T].forEach((c,j)=>{'$*'.includes(c)&&B.push(j);'@+'.includes(c)&&(P=j)});let Y=P/w|0,D=[-w,w,-1,1],L='udlr',X,out='',cur=P,seen={};
let flood=(s,E)=>{let Q={[s]:' '},q=[s];for(let c of q)D.forEach((d,k)=>{let m=c+d;if(T[m]!='#'&&!X[m]&&!E.includes(m)&&!Q[m])q.push(m),Q[m]=Q[c]+L[k]});return[Q,Math.min(...q)]},ID=i=>(i>=Y*w+w)*2+(i%w>6);
for(let id of new Set(B.map(ID))){let rb=[],ob=[];X=[];B.forEach(b=>ID(b)==id?rb.push(b):(X[b]=1,ob.push(b)));let q=[[rb,cur,'']],fb;for(let[bs,p,pth]of q){
if(bs.every(b=>'.*+'.includes(T[b]))){out+=pth;cur=p;fb=bs;break}let Q=flood(p,bs)[0];for(let b of bs)D.forEach((d,k)=>{let ds=b+d;if(T[ds]=='#'||ID(ds)!=id||(ds/w|0)==Y||bs.includes(ds))return;
let s=Q[b-d];if(s){let nbs=bs.map(v=>v-b?v:ds).sort();let kk=nbs+'|'+flood(b,nbs)[1];if(!seen[kk]){seen[kk]=1;q.push([nbs,b,pth+s+L[k]])}}})}
if(!fb)return'';B=ob.concat(fb)}return out};F.readdirSync(I).forEach(id=>{let d='/'+id;F.mkdirSync(O+d,{recursive:!0});F.writeFileSync(O+d+'/solution.txt',S(F.readFileSync(I+d+'/level.txt')+'')+'\n')})
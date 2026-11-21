import*as F from'node:fs';
const E=process.env,I=E.MAKEFUN_INPUT_DIR??'/input',O=E.MAKEFUN_OUTPUT_DIR??'/output',X=8e5,D=[[0,-1,'u','U'],[0,1,'d','D'],[-1,0,'l','L'],[1,0,'r','R']];
function P(t){
const r=t.split('\n').filter(r=>r.length),h=r.length,w=Math.max(...r.map(r=>r.length)),a=new Uint8Array(w*h).fill(1),g=[],b=[];let p=-1;
r.forEach((row,y)=>{for(let x=0;x<row.length;x++){const c=row[x],i=y*w+x;if(c=='#')continue;a[i]=0;if(c=='.'||c=='*'||c=='+')g.push(i);if(c=='$'||c=='*')b.push(i);if(c=='@'||c=='+')p=i}});
for(let i=0;i<w*h;i++){let x=i%w,y=i/w|0;if(!x||!y||x==w-1||y==h-1)a[i]=1}
b.sort((x,y)=>x-y);
return{w,a,g,b,p}}
function V(L){
const{w,a,g}=L,l=new Uint8Array(a.length),q=[...g];
for(const x of g)l[x]=1;
for(let i=0;i<q.length;i++){const x=q[i];for(const[dx,dy]of D){const d=dy*w+dx,y=x-d;if(!a[y]&&!a[y-d]&&!l[y]){l[y]=1;q.push(y)}}}
return l}
function T(L){
const{w,a,g}=L;
return g.map(s=>{const d=new Int32Array(a.length).fill(-1),q=[s];d[s]=0;
for(let i=0;i<q.length;i++){const t=q[i];for(const[dx,dy]of D){const e=dy*w+dx,u=t-e;if(d[u]<0&&!a[u]&&!a[u-e]){d[u]=d[t]+1;q.push(u)}}}
return d})}
function R(L,o,f,s,st,k){
const w=L.w,a=L.a;let l=f,n=0;k[n++]=f;s[f]=st;
while(n){const p=k[--n];if(p<l)l=p;for(let j=0;j<4;j++){const q=j==0?p-w:j==1?p+w:j==2?p-1:p+1;if(!a[q]&&!o[q]&&s[q]!=st){s[q]=st;k[n++]=q}}}
return l}
function Q(L,o,g,t){
const w=L.w,a=L.a;
for(const x of[t,t-1,t-w,t-w-1]){const b=x+1,c=x+w,d=c+1;
if((a[x]||o[x])&&(a[b]||o[b])&&(a[c]||o[c])&&(a[d]||o[d])&&((o[x]&&!g[x])||(o[b]&&!g[b])||(o[c]&&!g[c])||(o[d]&&!g[d])))return 1}
return 0}
function C(x){let c=0;while(x){x&=x-1;c++}return c}
function S(L,mx=X,uh=1){
const w=L.w,a=L.a,g=L.g,z=a.length,n=L.b.length,gl=new Uint8Array(z);
for(const x of g)gl[x]=1;
const lv=V(L);
if(L.b.some(b=>!lv[b]))return null;
const tb=T(L),es=B=>{
if(!uh)return 0;
if(n<=6){const f=(1<<n)-1,dp=Array(1<<n).fill(1/0);dp[0]=0;
for(let m=0;m<=f;m++){const bi=C(m);if(bi>=n||dp[m]==1/0)continue;
for(let gi=0;gi<n;gi++){if(m&1<<gi)continue;const c=tb[gi][B[bi]];if(c>=0)dp[m|1<<gi]=Math.min(dp[m|1<<gi],dp[m]+c)}}
return dp[f]}
let s=0;
for(const b of B){let e=1/0;for(const t of tb)if(t[b]>=0)e=Math.min(e,t[b]);if(e==1/0)return 1/0;s+=e}
return s},
oc=new Uint8Array(z),sn=new Int32Array(z),mk=new Int32Array(z),sk=new Int32Array(z);
let st=0;
const sv=B=>B.every(b=>gl[b]==1),ky=(B,l)=>String.fromCharCode(l,...B),sB=[...L.b],sP=[L.p],sG=[0],pa=[-1],bg=new Map(),oc1=(B,v)=>{for(const x of B)oc[x]=v};
oc1(L.b,1);bg.set(ky(L.b,R(L,oc,L.p,sn,++st,sk)),0);oc1(L.b,0);
const hp=[],ls=(A,B)=>A[0]<B[0]||A[0]==B[0]&&(A[1]<B[1]||A[1]==B[1]&&A[2]<B[2]),hP=e=>{let i=hp.length;hp.push(e);while(i){const p=(i-1)>>1;if(!ls(hp[i],hp[p]))break;[hp[i],hp[p]]=[hp[p],hp[i]];i=p}},hO=()=>{const t=hp[0],l=hp.pop();if(hp.length){hp[0]=l;for(let i=0;;){let c=2*i+1;if(c>=hp.length)break;if(c+1<hp.length&&ls(hp[c+1],hp[c]))c++;if(!ls(hp[c],hp[i]))break;[hp[i],hp[c]]=[hp[c],hp[i]];i=c}}return t},h0=es(L.b);
if(h0==1/0)return null;
hP([h0,h0,0]);
let fd=-1;
while(hp.length&&fd<0){
const s=hO()[2],B=sB.slice(s*n,s*n+n);
oc1(B,1);
const lo=R(L,oc,sP[s],sn,++st,sk);
if(bg.get(ky(B,lo))!=sG[s]){oc1(B,0);continue}
if(sv(B)){fd=s;oc1(B,0);break}
const hr=st,gg=sG[s];
for(let bi=0;bi<n;bi++){const b=B[bi];
for(const[dx,dy]of D){const d=dy*w+dx,t=b+d;
if(sn[b-d]!=hr||a[t]||oc[t]||!lv[t])continue;
oc[b]=0;oc[t]=1;
const fz=Q(L,oc,gl,t);let nx=null,k2='';
if(!fz){nx=B.slice();nx[bi]=t;nx.sort((x,y)=>x-y);k2=ky(nx,R(L,oc,b,mk,++st,sk))}
oc[t]=0;oc[b]=1;
if(fz||!nx)continue;
const sg=bg.get(k2);
if(sg<=gg+1)continue;
const h=es(nx);
if(h==1/0)continue;
if(sP.length>=mx){oc1(B,0);return null}
bg.set(k2,gg+1);sB.push(...nx);sP.push(b);sG.push(gg+1);pa.push(s);hP([gg+1+h,h,sP.length-1])}}
oc1(B,0)}
if(fd<0)return null;
const pt=[];
for(let s=fd;s>0;s=pa[s])pt.push(s);
pt.reverse();
let mv='',pl=L.p,cb=L.b;
for(const s of pt){
const nb=sB.slice(s*n,s*n+n),fr=cb.find(b=>!nb.includes(b)),to=nb.find(b=>!cb.includes(b)),d=to-fr,dr=D.find(([dx,dy])=>dy*w+dx==d);
oc1(cb,1);mv+=W(L,oc,pl,fr-d);oc1(cb,0);mv+=dr[3];pl=fr;cb=nb}
return[pt.length,mv]}
function W(L,o,f,t){
const w=L.w,a=L.a;
if(f==t)return'';
const pv=new Int32Array(a.length).fill(-1),hw=[],q=[f];
pv[f]=f;
for(let i=0;i<q.length;i++){const p=q[i];if(p==t)break;
for(const[dx,dy,lt]of D){const u=p+dy*w+dx;if(a[u]||o[u]||pv[u]!=-1)continue;pv[u]=p;hw[u]=lt;q.push(u)}}
if(pv[t]==-1)throw 0;
let s='';
for(let p=t;p!=f;p=pv[p])s=hw[p]+s;
return s}
function N(w,f,m){let p=f;for(const c of m.toLowerCase())p+=c=='u'?-w:c=='d'?w:c=='l'?-1:1;return p}
function M(L){
const w=L.w,a=L.a,g=L.g,b=L.b,p=L.p,lv=V(L),row=p/w|0,ct=new Uint8Array(a.length);
for(let i=row*w;i<(row+1)*w;i++)if(!a[i]&&!lv[i])ct[i]=1;
if(b.some(x=>ct[x]))return null;
const pt=new Int32Array(a.length).fill(-1),rm=[];
for(let s=0;s<a.length;s++){
if(a[s]||ct[s]||pt[s]>=0)continue;
const sq=[s];pt[s]=rm.length;
for(let i=0;i<sq.length;i++)for(const[dx,dy]of D){const q=sq[i]+dy*w+dx;if(!a[q]&&!ct[q]&&pt[q]<0){pt[q]=rm.length;sq.push(q)}}
rm.push({b:[],g:[]})}
for(const x of b)rm[pt[x]].b.push(x);
for(const x of g)if(pt[x]>=0)rm[pt[x]].g.push(x);
if(g.some(x=>pt[x]<0)||rm.some(r=>r.b.length!=r.g.length))return null;
return rm.filter(r=>r.b.length)}
function Y(L){
const rm=M(L);
if(!rm)return S(L);
let p=L.p,ps=0,mv='';
for(const r of rm){
const a=L.a.slice();
for(const o of rm)if(o!=r)for(const x of o.d?o.g:o.b)a[x]=1;
const sb={w:L.w,a,g:r.g.slice().sort((x,y)=>x-y),b:r.b.slice().sort((x,y)=>x-y),p},sd=S(sb)??S(sb,X*3,0);
if(!sd)return null;
ps+=sd[0];mv+=sd[1];p=N(L.w,p,sd[1]);r.d=1}
return[ps,mv]}
function Z(t){
const L=P(t);
if(!L.b.length)return'';
const s=Y(L)??S(L,X*3,0);
return s?s[1]:''}
for(const id of F.readdirSync(I).sort()){
let m='';
try{m=Z(F.readFileSync(I+'/'+id+'/level.txt','utf8'))}catch{}
F.mkdirSync(O+'/'+id,{recursive:true});
F.writeFileSync(O+'/'+id+'/solution.txt',m+'\n')}

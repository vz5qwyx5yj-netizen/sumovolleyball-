// Dezelfde meter, activeringsregels en effecten voor speler en computer.
const POWER_CONTACTS=3;
const powers={
  rood:{name:'Supersmash',description:'Activeer voor één extra harde slag.'},
  geel:{name:'Dubbele sprong',description:'Activeer in de lucht voor een extra sprong.'},
  turquoise:{name:'Sprint',description:'Sprint kort vooruit. Stuur met links en rechts.'},
  paars:{name:'Schild',description:'Blokkeer één bal met groter bereik, tot 1,5 seconde.'}
};
let powerRequested=false;
let powerUISignature='';
const powerBtn=document.getElementById('powerBtn');

function newPowerState(){
  return {charge:0,active:false,ticks:0,flash:0,contactCooldown:0,airJumpUsed:false,direction:1};
}
function clearActivePowers(){
  for(const p of [p1,p2]){
    const charge=p.power.charge;
    p.power=newPowerState();
    p.power.charge=charge;
  }
  powerRequested=false;
}
function canActivatePower(p){
  if(!running || over || dead || serveMode || p.power.charge<POWER_CONTACTS || p.power.active) return false;
  return p.charId!=='geel' || (!p.grounded && !p.power.airJumpUsed);
}
function activatePower(p,direction=0){
  if(!canActivatePower(p)) return false;
  p.power.charge=0;
  p.power.flash=24;
  if(p.charId==='geel'){
    p.power.airJumpUsed=true;
    p.vy=-Math.sqrt(2*G_PLR*MAX_JUMP()*p.stats.jump*.75);
    p.onNet=false;
  }else{
    p.power.active=true;
    // Koa bewaart zijn geactiveerde slag tot contact of het einde van de rally.
    p.power.ticks=p.charId==='turquoise'?45:p.charId==='paars'?90:0;
    p.power.direction=direction || p.facing;
  }
  return true;
}
function chargePower(p){
  if(serveMode || dead || over || p.power.contactCooldown>0) return;
  p.power.charge=Math.min(POWER_CONTACTS,p.power.charge+1);
  // Herhaalde overlap binnen één contact is geen nieuwe terugspeelbal.
  p.power.contactCooldown=12;
}
function tickPowers(){
  if(dead) return;
  for(const p of [p1,p2]){
    if(p.power.ticks>0 && --p.power.ticks===0) p.power.active=false;
    if(p.power.flash>0) p.power.flash--;
    if(p.power.contactCooldown>0) p.power.contactCooldown--;
    if(p.grounded) p.power.airJumpUsed=false;
  }
}
function ballContactRadius(p){
  return PR()+(p.charId==='paars' && p.power.active?20:0);
}

function considerCPUPower(observed){
  if(!canActivatePower(p2)) return;
  // Gebruik alleen dezelfde vertraagde waarneming als voor bewegen/springen.
  const perceived={...observed};
  for(let i=0;i<difficulties[matchDifficulty].reactionSteps;i++) stepBallFlight(perceived);
  const dx=perceived.x-p2.x,dy=perceived.y-p2.y;
  const targetDx=cpuPlan.targetX-p2.x;
  let useful=false;
  if(p2.charId==='rood') useful=Math.abs(dx)<65 && dy<0 && dy>-120 && p2.y<NET_TOP()-PR() && perceived.vy>-3;
  if(p2.charId==='geel') useful=Math.abs(dx)<85 && dy<-50 && dy>-270 && p2.vy>=0;
  if(p2.charId==='turquoise') useful=Math.abs(targetDx)>65 && perceived.x>NET_X();
  if(p2.charId==='paars') useful=Math.hypot(dx,dy)<120 && dx*(perceived.vx-p2.vx)+dy*(perceived.vy-p2.vy)<0;
  if(useful) activatePower(p2,Math.sign(targetDx));
}

function requestPower(){
  if(canActivatePower(p1)) powerRequested=true;
}
powerBtn.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse' && e.button!==0) return;
  e.preventDefault();
  requestPower();
});
powerBtn.addEventListener('click',e=>{
  if(e.detail===0) requestPower(); // Toetsenbord / ondersteunende bediening.
});

function syncPowerUI(){
  if(!p1 || !p2) return;
  const canUse=canActivatePower(p1);
  const signature=[p1.charId,p2.charId,p1.power.charge,p2.power.charge,p1.power.active,p2.power.active,canUse,serveMode,p1.grounded,p1.power.airJumpUsed].join('|');
  if(signature===powerUISignature) return;
  powerUISignature=signature;
  for(const p of [p1,p2]){
    const status=p.power.active?'Actief':p.power.charge===POWER_CONTACTS?'Klaar':`${p.power.charge}/${POWER_CONTACTS}`;
    const el=document.getElementById(p.side===0?'p1Power':'p2Power');
    el.textContent='⚡ '+status;
    el.classList.toggle('power-ready',p.power.charge===POWER_CONTACTS || p.power.active);
    el.setAttribute('aria-label',`${powers[p.charId].name}: ${status}`);
  }
  let hint=`${p1.power.charge}/${POWER_CONTACTS} contacten`;
  if(p1.power.active) hint='Actief';
  else if(p1.power.charge===POWER_CONTACTS){
    hint=serveMode?'Na de service':canUse?'Klaar · E':p1.charId==='geel'?'Spring eerst':'Even wachten';
    if(p1.charId==='geel' && p1.power.airJumpUsed && !p1.grounded) hint='Land eerst';
  }
  powerBtn.disabled=!canUse;
  powerBtn.classList.toggle('ready',canUse);
  powerBtn.classList.toggle('active',p1.power.active);
  powerBtn.setAttribute('aria-label',`${powers[p1.charId].name}: ${hint}. Activeer met E of deze knop.`);
  document.getElementById('powerBtnStatus').textContent=hint;
  powerBtn.style.setProperty('--charge',`${p1.power.charge/POWER_CONTACTS*100}%`);
}

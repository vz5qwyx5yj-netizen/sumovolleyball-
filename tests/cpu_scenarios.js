// Dezelfde inkomende ballen en toevalsreeksen voor elk niveau en personage.
// Controleer terugslagen over het net, niet alleen interne AI-instellingen.
()=>{
  const originalRandom=Math.random;
  const originalDifficulty=selectedDifficulty;
  const originalChars={...chosenChars};
  const results={};
  try{
    for(const level of Object.keys(difficulties)){
      const totals={returns:0,smashes:0,total:0,serves:0};
      for(const charId of Object.keys(charStats)){
        for(const y of [260,320,380,430]){
          for(const vx of [1.5,3.5,5.5,7.5]){
            for(const vy of [-3,0,3,6]){
              for(let seed=1;seed<=4;seed++){
                let rng=seed*7919;
                Math.random=()=>{
                  rng=(Math.imul(rng,1664525)+1013904223)>>>0;
                  return rng/4294967296;
                };
                selectedDifficulty=level;
                chosenChars.p1='rood'; chosenChars.p2=charId;
                srv=0; init(); running=true; serveMode=false; p1.x=33;
                ball={x:260,y,vx,vy,spin:0};
                let caught=false,returned=false,smashed=false;
                for(let step=0;step<240 && !dead;step++){
                  update();
                  if(p2.hitT>0) caught=true;
                  if(impact && impact.smash && p2.hitT>0) smashed=true;
                  if(caught && ball.x<NET_X()-BR() && ball.vx<0){
                    returned=true;
                    break;
                  }
                }
                totals.total++;
                if(returned) totals.returns++;
                if(smashed) totals.smashes++;
              }
            }
          }
        }
        srv=1; init(); running=true; p1.x=33;
        for(let step=0;step<240 && !dead;step++){
          update();
          if(!serveMode && ball.x<NET_X()-BR() && ball.vx<0){
            totals.serves++;
            break;
          }
        }
      }
      results[level]=totals;
    }
    return results;
  }finally{
    Math.random=originalRandom;
    selectedDifficulty=originalDifficulty;
    Object.assign(chosenChars,originalChars);
    srv=0; init();
  }
}

()=>{
  const savedChars={...chosenChars},savedDifficulty=selectedDifficulty;
  const checks=[];
  const check=(condition,message)=>{if(!condition)throw new Error(message);};
  const setup=(id='rood')=>{
    chosenChars.p1=id; chosenChars.p2=id;
    srv=0; init(); running=true; serveMode=false;
  };
  const incoming=p=>{ball={x:p.x,y:p.y-PR()-BR()+4,vx:0,vy:5,spin:0};};
  const nextContact=()=>{for(let i=0;i<12;i++)tickPowers();};
  const playerStep=(p,left=false,right=false)=>updatePlayer(p,p.side===0?p1NB:p2NB,()=>left,()=>right,()=>false,()=>false,()=>{});
  try{
    setup();
    for(const p of [p1,p2]){
      incoming(p); serveMode=true; hitBall(p);
      check(p.power.charge===0,'Service laadt de kracht niet op');
      serveMode=false;
      incoming(p);hitBall(p);
      check(p.power.charge===1,'Eerste echte terugslag telt voor beide spelers');
      incoming(p);hitBall(p);
      check(p.power.charge===1,'Herhaalde overlap laadt niet dubbel op');
      nextContact();incoming(p);ball.vy=-5;hitBall(p);
      check(p.power.charge===1,'Een bal die al wegvliegt is geen goed contact');
      for(let i=0;i<4;i++){nextContact();incoming(p);hitBall(p);}
      check(p.power.charge===3,'Meter vult en stopt bij drie contacten');
    }
    resetPositions();
    check(p1.power.charge===3 && p2.power.charge===3,'Meter blijft tussen punten bewaard');
    init();
    check(p1.power.charge===0 && p2.power.charge===0,'Nieuwe wedstrijd start leeg');
    checks.push('opladen door echte contacten; gelijke regels en bewaren tussen punten');

    for(const side of [0,1]){
      setup();
      const p=side===0?p1:p2;
      p.grounded=false;p.y=400;p.vy=0;
      incoming(p);hitBall(p);
      const ordinary=Math.abs(ball.vx);
      p.power.charge=3;
      check(activatePower(p),'Koa kan een volle kracht activeren');
      check(p.power.charge===0 && p.power.active,'Kracht kost de volle meter');
      incoming(p);hitBall(p);
      check(Math.abs(ball.vx)>ordinary*1.4 && impact.power,'Supersmash slaat harder dan gewone smash');
      check(!p.power.active,'Supersmash geldt voor één contact');
      incoming(p);hitBall(p);
      check(Math.abs(ball.vx)===ordinary,'Volgende contact is weer normaal');
    }
    checks.push('Koa: één extra harde slag aan beide kanten');

    setup('geel');p1.power.charge=3;
    check(!activatePower(p1) && p1.power.charge===3,'Riku verbruikt geen kracht op de grond');
    p1.grounded=false;p1.y=450;p1.vy=5;
    const beforeY=p1.y;
    check(activatePower(p1),'Riku activeert in de lucht');
    playerStep(p1);
    check(p1.y<beforeY && p1.vy<0,'Tweede sprong brengt een vallende Riku omhoog');
    p1.power.charge=3;
    check(!activatePower(p1),'Geen derde sprong in dezelfde vlucht');
    p1.y=GND()-PR()-1;p1.vy=5;playerStep(p1);
    check(p1.grounded && !p1.power.airJumpUsed,'Landen maakt een latere dubbele sprong mogelijk');
    checks.push('Riku: extra sprong alleen in de lucht, maximaal één per vlucht');

    setup('turquoise');playerStep(p1,false,true);
    const normalSpeed=p1.vx;
    p1.power.charge=3;activatePower(p1,1);playerStep(p1);
    check(p1.vx>normalSpeed*1.7,'Nalu sprint werkelijk sneller');
    playerStep(p1,true,false);
    check(p1.vx<0,'Sprint blijft bestuurbaar');
    p1.x=NET_X()-NET_W()-PR()-.5;p1.power.direction=1;
    playerStep(p1);
    check(p1.x<=NET_X()-NET_W()-PR(),'Sprint gaat niet door de paal');
    for(let i=0;i<45;i++)tickPowers();
    check(!p1.power.active,'Sprint eindigt na 0,75 seconde speltijd');
    checks.push('Nalu: versnellen, sturen, paalbotsing en eindige duur');

    setup('paars');p2.x=350;
    ball={x:p2.x-60,y:p2.y,vx:5,vy:0,spin:0};hitBall(p2);
    check(ball.vx===5,'Bal buiten normaal bereik wordt niet geraakt');
    p2.power.charge=3;activatePower(p2);
    hitBall(p2);
    check(ball.vx<0 && !p2.power.active,'Schild blokkeert dezelfde bal met groter bereik, één keer');
    p1.power.charge=3;activatePower(p1);
    for(let i=0;i<90;i++)tickPowers();
    check(!p1.power.active && ballContactRadius(p1)===PR(),'Ongebruikt schild eindigt na 1,5 seconde');
    checks.push('Mako: groter bereik voor één blokkade en vaste eindtijd');

    for(const level of Object.keys(difficulties)){
      for(const id of Object.keys(powers)){
        selectedDifficulty=level;setup(id);
        p2.power.charge=3;
        if(id==='rood'){
          p2.y=400;p2.grounded=false;ball={x:p2.x,y:280,vx:0,vy:2,spin:0};
        }else if(id==='geel'){
          p2.y=500;p2.vy=3;p2.grounded=false;ball={x:p2.x,y:320,vx:0,vy:0,spin:0};
        }else if(id==='turquoise'){
          p2.x=280;ball={x:410,y:400,vx:0,vy:1,spin:0};
        }else{
          p2.x=350;ball={x:260,y:570,vx:2,vy:0,spin:0};
        }
        for(let i=0;i<difficulties[level].reactionSteps;i++)updateCPU();
        check(p2.power.charge===3,'CPU wacht op zijn waarneming: '+level+'/'+id);
        updateCPU();
        check(p2.power.charge===0,'CPU gebruikt een verdiende kracht in geschikte situatie: '+level+'/'+id);
        check(!activatePower(p2),'CPU mag geen gratis tweede kracht gebruiken');
      }
    }
    checks.push('CPU: alle vier krachten op alle niveaus, met reactietijd en dezelfde kosten');

    setup('paars');p1.power.charge=3;activatePower(p1);
    pauseGame();const paused=JSON.stringify(p1.power);
    __frame(__testTime+5000);
    check(JSON.stringify(p1.power)===paused,'Pauzeren bevriest de kracht');
    check(!activatePower(p1),'Geen activering tijdens pauze');resumeGame();
    p2.power.charge=2;
    ball={x:50,y:GND()-BR()-1,vx:0,vy:3,spin:0};update();
    check(dead && !p1.power.active && p2.power.charge===2,'Punt beëindigt effecten en bewaart ongebruikte lading');
    p1.power.charge=3;check(!activatePower(p1),'Geen activering tijdens puntpauze');
    resetPositions();dead=false;serveMode=true;
    check(!activatePower(p1) && p1.power.charge===3,'Geen verspilling tijdens de service');
    checks.push('pauze, puntwissel en service beschermen de krachtmeter');
    return checks;
  }finally{
    Object.assign(chosenChars,savedChars);selectedDifficulty=savedDifficulty;
    srv=0;init();running=true;menuMode='playing';showPlayingControls(true);
  }
}

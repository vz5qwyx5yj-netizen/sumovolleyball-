// Alle illustraties worden in dezelfde wereldcoördinaten als de physics getekend.
function artPolygon(points,fill){
  ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();
  ctx.fillStyle=fill;
  ctx.fill();
}

function drawBeach(){
  if(bgReady){
    ctx.drawImage(bgImg,0,0,VW,VH);
  } else {
    const sky=ctx.createLinearGradient(0,0,0,GND());
    sky.addColorStop(0,'#1568bd');sky.addColorStop(1,'#bce9e5');
    ctx.fillStyle=sky;ctx.fillRect(0,0,VW,VH);
    ctx.fillStyle='#f1d89a';ctx.fillRect(0,VH*.65,VW,VH*.35);
  }
  // De speelgrens ligt precies op de grond van de physics.
  ctx.strokeStyle='#aa925f35';ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(0,GND()+2);ctx.lineTo(VW,GND()+2);ctx.stroke();
  ctx.strokeStyle='#fff9dfd9';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,GND());ctx.lineTo(VW,GND());ctx.stroke();

  const x=NET_X(),y=NET_TOP(),bottom=GND(),half=NET_W();
  artPolygon([[x-half,bottom],[x+half,bottom],[x+48,bottom+28],[x+29,bottom+28]],'#635c4528');
  artPolygon([[x-half,y+5],[x-half+5,y],[x+half-5,y],[x+half,y+5],[x+half,bottom],[x-half,bottom]],'#716457');
  artPolygon([[x-half+3,y+5],[x-2,y+3],[x-2,bottom],[x-half+3,bottom]],'#a2947d');
  artPolygon([[x+4,y+4],[x+half,y+5],[x+half,bottom],[x+4,bottom]],'#534e46');
  artPolygon([[x-half,y+5],[x-half+5,y],[x+half-5,y],[x+half,y+5],[x+3,y+8],[x-4,y+8]],'#c0b69e');
  // Een smalle netrand en twee bindringen geven de paal diepte.
  ctx.fillStyle='#e9dfba';
  ctx.fillRect(x-half-1,y+19,half*2+2,4);
  ctx.fillRect(x-half-1,bottom-19,half*2+2,4);
  ctx.fillStyle='#c0b28f';
  ctx.fillRect(x+4,y+19,half-3,4);ctx.fillRect(x+4,bottom-19,half-3,4);
}

function drawFighter(p){
  const c=characters[p.charId]||characters.rood;
  const jumpH=Math.max(0,GND()-PR()-p.y);
  const shadowScale=Math.max(.25,1-jumpH/360);
  ctx.fillStyle=`rgba(88,75,47,${.23*shadowScale})`;
  ctx.beginPath();ctx.ellipse(p.x,GND()+3,PR()*.9*shadowScale,5*shadowScale,0,0,Math.PI*2);ctx.fill();

  const size=PR()*2.55;
  const bob=p.grounded?Math.sin(p.bobT)*1.3:0;
  const hitSquash=p.hitT>0?Math.sin(Math.min(1,p.hitT/16)*Math.PI)*.065:0;
  const airStretch=p.grounded?0:Math.min(.045,Math.abs(p.vy)*.003);
  ctx.save();
  ctx.translate(p.x,p.y+PR()-bob);
  ctx.rotate(Math.max(-.1,Math.min(.1,-p.vx*.013)));
  ctx.scale((p.side===0?1:-1)*(1+hitSquash-airStretch),1-hitSquash+airStretch);
  if(atlasReady){
    const sw=sumoAtlas.naturalWidth/2,sh=sumoAtlas.naturalHeight/2;
    ctx.drawImage(sumoAtlas,c.cell[0]*sw,c.cell[1]*sh,sw,sh,-size/2,-size*.97,size,size);
  } else {
    // Een leesbaar silhouet terwijl de illustratie laadt.
    artPolygon([[-23,-9],[-31,-34],[-23,-55],[-12,-68],[11,-68],[25,-52],[31,-29],[21,-9]],'#c9936e');
    artPolygon([[-24,-22],[25,-22],[21,-9],[-23,-9]],c.color);
    artPolygon([[-12,-68],[-9,-77],[8,-76],[15,-66]],'#333239');
  }
  ctx.restore();
}

function drawBall(){
  if(dead) return;
  const radius=BR();
  const shadowScale=Math.max(.2,1-(GND()-ball.y)/400);
  ctx.fillStyle='#62543725';
  ctx.beginPath();ctx.ellipse(ball.x,GND()+1,radius*shadowScale,radius*.22*shadowScale,0,0,Math.PI*2);ctx.fill();
  if(ballTrail.length>1){
    for(let i=0;i<ballTrail.length-1;i++){
      const t=(i+1)/ballTrail.length;
      ctx.globalAlpha=t*(ball.trailColor ? .42 : .18);
      ctx.fillStyle=ball.trailColor||'#fff7ce';
      ctx.beginPath();ctx.arc(ballTrail[i].x,ballTrail[i].y,radius*t*.65,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(ball.spin);
  ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.clip();
  const colors=['#f46f51','#fff4d7','#efc34c','#51ada0','#fff4d7','#5499bd'];
  colors.forEach((color,i)=>{
    ctx.beginPath();ctx.moveTo(-3,-4);ctx.arc(0,0,radius+1,i*Math.PI/3,(i+1)*Math.PI/3);ctx.closePath();ctx.fillStyle=color;ctx.fill();
  });
  artPolygon([[-radius,4],[2,10],[radius,0],[radius,radius],[-radius,radius]],'#2c46351c');
  artPolygon([[-10,-9],[-1,-14],[6,-9],[-5,-4]],'#ffffff5c');
  ctx.restore();
  ctx.strokeStyle='#fff7db';ctx.lineWidth=1.4;
  ctx.beginPath();ctx.arc(ball.x,ball.y,radius,0,Math.PI*2);ctx.stroke();
}

function drawImpact(){
  if(!impact || dead) return;
  const duration=impact.smash?24:12;
  const progress=1-impact.life/duration;
  ctx.save();ctx.translate(impact.x,impact.y);
  ctx.globalAlpha=1-progress;
  ctx.strokeStyle=impact.smash?'#fff5c1':impact.color;
  ctx.lineWidth=impact.smash?3:2;
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    const inner=BR()+4+progress*16,outer=inner+(impact.smash?13:6);
    ctx.beginPath();ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);
    ctx.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer);ctx.stroke();
  }
  ctx.restore();
  if(impact.smash){
    ctx.save();
    ctx.translate(Math.max(70,Math.min(VW-70,impact.x)),Math.max(170,impact.y-46-progress*12));
    ctx.rotate(-.08);ctx.globalAlpha=Math.min(1,impact.life/8);
    ctx.font='900 24px "Avenir Next", sans-serif';ctx.textAlign='center';ctx.lineJoin='round';
    ctx.strokeStyle=impact.color;ctx.lineWidth=5;ctx.strokeText('SMASH!',0,0);
    ctx.fillStyle='#fffbea';ctx.fillText('SMASH!',0,0);ctx.restore();
  }
}

function drawPoint(){
  if(!dead) return;
  const playerScored=ball.x>=NET_X();
  ctx.save();
  ctx.fillStyle='#fff9e9f2';ctx.shadowColor='#2a483f20';ctx.shadowBlur=16;
  ctx.beginPath();ctx.roundRect(82,315,VW-164,96,22);ctx.fill();
  ctx.shadowBlur=0;ctx.textAlign='center';
  ctx.fillStyle='#6c8070';ctx.font='800 10px "Avenir Next", sans-serif';
  ctx.fillText('GOED GESPEELD',VW/2,342);
  ctx.fillStyle=playerScored?'#237c76':'#d86950';
  ctx.font='900 26px "Avenir Next", sans-serif';ctx.fillText(playerScored?'JIJ SCOORT!':'CPU SCOORT!',VW/2,378);
  ctx.restore();
}

function draw(){
  ctx.setTransform(SCALE,0,0,SCALE,0,0);
  ctx.clearRect(0,0,VW,VH);
  drawBeach();
  drawFighter(p1);drawFighter(p2);
  drawBall();drawImpact();drawPoint();
}

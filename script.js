/* Embedded simple top-down canvas game.
 - Mobile & desktop controls
 - Lantern cone reveal
 - Random simple path rows
 - Duplicate encounter and swap ending
 - Ambient noise generated via WebAudio (toggleable)
*/

(() => {
  // Elements
  const playBtn = document.getElementById('playBtn');
  const gameWrap = document.getElementById('gameWrap');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const distanceEl = document.getElementById('distance');
  const soundToggle = document.getElementById('soundToggle');
  const mobileControls = document.getElementById('mobileControls');
  const upBtn = document.getElementById('up'), downBtn = document.getElementById('down'), leftBtn = document.getElementById('left'), rightBtn = document.getElementById('right');
  const dpi = window.devicePixelRatio || 1;

  // Settings
  const world = { cols: 15, rows: 12, cell: 48 };
  let WIDTH = canvas.width, HEIGHT = canvas.height;
  let audioOn = true;

  // Game state
  let map = [];
  let player = {x: 2, y: Math.floor(world.rows/2), px:0, py:0, speed: 2.2, lantern: 120 };
  let duplicate = null;
  let inForest = false;
  let swapped = false;
  let gameRunning = false;
  let ambient = null;

  // Input
  const keys = { up:false, down:false, left:false, right:false };

  function setupCanvas(){
    const rect = canvas.getBoundingClientRect();
    WIDTH = rect.width;
    HEIGHT = rect.height;
    canvas.width = Math.floor(WIDTH * dpi);
    canvas.height = Math.floor(HEIGHT * dpi);
    canvas.style.width = WIDTH + 'px';
    canvas.style.height = HEIGHT + 'px';
    ctx.setTransform(dpi,0,0,dpi,0,0);
  }

  function makeMap(){
    map = [];
    for(let r=0;r<world.rows;r++){
      // each row has walls across with a random opening position
      let row = { openings: [] };
      // generate a winding opening column index
      let open = Math.max(1, Math.min(world.cols-2, Math.floor(world.cols/2 + (Math.sin(r*1.3)*3) + Math.floor(Math.random()*3-1))));
      row.open = open;
      map.push(row);
    }
  }

  function drawBackground(){
    ctx.fillStyle = '#060607';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    // distant trees as vertical streaks
    for(let i=0;i<18;i++){
      ctx.fillStyle = 'rgba(10,10,12,'+ (0.03 + Math.random()*0.08) +')';
      let x = (i/18)*WIDTH + Math.sin(i*3)*20;
      ctx.fillRect(x, 40 + (i%3)*10, 14, HEIGHT-80);
    }
  }

  function worldToScreen(cx, cy){
    // center camera around player
    const camX = player.px - WIDTH/2;
    const camY = player.py - HEIGHT/2;
    return { x: Math.round(cx - camX), y: Math.round(cy - camY) };
  }

  function drawMap(){
    const cell = world.cell;
    for(let r=0;r<world.rows;r++){
      for(let c=0;c<world.cols;c++){
        let sx = c*cell, sy = r*cell;
        // base ground
        ctx.fillStyle = '#091015';
        let scr = worldToScreen(sx, sy);
        ctx.fillRect(scr.x, scr.y, cell-2, cell-2);
        // walls except opening column
        if(c !== map[r].open){
          ctx.fillStyle = '#071013';
          ctx.fillRect(scr.x, scr.y, cell-2, cell-2);
          // tree trunk
          ctx.fillStyle = 'rgba(30,22,20,0.6)';
          ctx.fillRect(scr.x+10, scr.y, 10, cell-2);
        } else {
          // opening path slightly lighter
          ctx.fillStyle = '#11141a';
          ctx.fillRect(scr.x, scr.y, cell-2, cell-2);
        }
      }
    }
  }

  function drawPlayer(){
    // camera follows player p pos in pixels
    const r = world.cell/2;
    const s = worldToScreen(player.px, player.py);

    // lantern glow (radial gradient)
    const grad = ctx.createRadialGradient(s.x, s.y, 20, s.x, s.y, player.lantern);
    grad.addColorStop(0, 'rgba(255,235,200,0.95)');
    grad.addColorStop(0.4, 'rgba(255,220,140,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, player.lantern, 0, Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // player body
    ctx.fillStyle = '#e6d9c4';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8, 0, Math.PI*2);
    ctx.fill();
    // lantern icon
    ctx.fillStyle = '#d9a94b';
    ctx.fillRect(s.x+10, s.y-4, 6, 8);
  }

  function drawDuplicate(){
    if(!duplicate) return;
    const s = worldToScreen(duplicate.px, duplicate.py);
    // subtle glow different color
    const grad = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 28);
    grad.addColorStop(0, 'rgba(180,200,255,0.9)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10, 0, Math.PI*2);
    ctx.fill();
    // body outline
    ctx.strokeStyle = 'rgba(200,220,255,0.7)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9, 0, Math.PI*2);
    ctx.stroke();
  }

  function generatePlayerPixelPos(){
    player.px = player.x * world.cell + world.cell/2;
    player.py = player.y * world.cell + world.cell/2;
  }

  function spawnDuplicate(){
    // spawn duplicate near a glowing ancient tree in some deeper row
    const r = Math.max( Math.min(world.rows-2, Math.floor(Math.random()*(world.rows-3)+3)), 3);
    const c = map[r].open;
    duplicate = { x:c, y:r, px:c*world.cell + world.cell/2, py:r*world.cell + world.cell/2, state: 'idle' };
  }

  function startGame(){
    setupCanvas();
    makeMap();
    generatePlayerPixelPos();
    spawnDuplicate();
    inForest = true;
    swapped = false;
    gameRunning = true;
    playBtn.textContent = 'إعادة التشغيل';
    document.getElementById('main').scrollIntoView({behavior:'smooth'});
    if(audioOn) startAmbient();
    loop();
  }

  function stopAmbient(){
    if(!ambient) return;
    try{ ambient.stop(); }catch(e){};
    ambient = null;
  }

  // Simple WebAudio ambient whispers generator (lightweight)
  let audioCtx, masterGain, noiseNode, filterNode, osc;
  function startAmbient(){
    if(ambient) return;
    try{
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.08;
      masterGain.connect(audioCtx.destination);

      // create filtered noise
      const bufferSize = 2*audioCtx.sampleRate;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random()*2-1) * Math.exp(-i / bufferSize * 4); // slight decay
      }
      noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'bandpass';
      filterNode.frequency.value = 700;
      filterNode.Q.value = 0.7;

      noiseNode.connect(filterNode);
      filterNode.connect(masterGain);
      noiseNode.start(0);
      ambient = noiseNode;

      // periodic whisper pulses (using oscillator gain)
      osc = audioCtx.createOscillator();
      const og = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 220;
      og.gain.value = 0.0001;
      osc.connect(og);
      og.connect(masterGain);
      osc.start();

    }catch(e){
      console.warn('Audio not available', e);
    }
  }

  function toggleAudio(){
    audioOn = !audioOn;
    if(!audioOn) stopAmbient();
    else startAmbient();
    soundToggle.textContent = audioOn ? 'إيقاف/تشغيل أصوات' : 'إيقاف/تشغيل أصوات';
  }

  soundToggle.addEventListener('click', toggleAudio);

  // Input handlers
  window.addEventListener('keydown', e => {
    if(e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
    if(e.key === 'ArrowDown' || e.key === 's') keys.down = true;
    if(e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if(e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  });
  window.addEventListener('keyup', e => {
    if(e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
    if(e.key === 'ArrowDown' || e.key === 's') keys.down = false;
    if(e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if(e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  });

  // Mobile touch handling (drag to move)
  let touchStart = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    touchStart = {x:t.clientX, y:t.clientY};
  }, {passive:false});
  canvas.addEventListener('touchmove', e => {
    if(!touchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    // small threshold
    keys.left = dx < -8;
    keys.right = dx > 8;
    keys.up = dy < -8;
    keys.down = dy > 8;
  }, {passive:false});
  canvas.addEventListener('touchend', e => { touchStart = null; keys.up=keys.down=keys.left=keys.right=false; });

  // Mobile buttons
  upBtn.addEventListener('touchstart', ()=>keys.up=true); upBtn.addEventListener('touchend', ()=>keys.up=false);
  downBtn.addEventListener('touchstart', ()=>keys.down=true); downBtn.addEventListener('touchend', ()=>keys.down=false);
  leftBtn.addEventListener('touchstart', ()=>keys.left=true); leftBtn.addEventListener('touchend', ()=>keys.left=false);
  rightBtn.addEventListener('touchstart', ()=>keys.right=true); rightBtn.addEventListener('touchend', ()=>keys.right=false);

  // Desktop buttons could be added similarly
  function update(dt){
    if(!gameRunning) return;
    // move player
    let vx=0, vy=0;
    if(keys.left) vx -= 1;
    if(keys.right) vx += 1;
    if(keys.up) vy -= 1;
    if(keys.down) vy += 1;
    // normalize
    if(vx!==0 || vy!==0){
      const mag = Math.sqrt(vx*vx + vy*vy);
      vx = vx/mag; vy = vy/mag;
    }
    // apply
    player.px += vx * player.speed * dt;
    player.py += vy * player.speed * dt;

    // clamp within world bounds (slight margins)
    const minX = world.cell/2, maxX = world.cols*world.cell - world.cell/2;
    const minY = world.cell/2, maxY = world.rows*world.cell - world.cell/2;
    player.px = Math.max(minX, Math.min(maxX, player.px));
    player.py = Math.max(minY, Math.min(maxY, player.py));

    // update distance to duplicate
    if(duplicate){
      const dx = duplicate.px - player.px;
      const dy = duplicate.py - player.py;
      const d = Math.sqrt(dx*dx + dy*dy);
      distanceEl.textContent = Math.max(0, Math.round(d));
      // if close and not swapped -> trigger encounter
      if(d < 48 && !swapped){
        triggerSwap();
      }
    }
    // duplicate simple idle movement or if swapped, walk to village
    if(duplicate){
      if(!swapped){
        // idle slight bobbing
        duplicate.px += Math.sin(Date.now()/800 + duplicate.y)*0.02;
      } else {
        // when swapped, duplicate acts as new player and walks toward exit (left side)
        const targetX = world.cell; // left-most village center
        const ay = duplicate.py, ax = duplicate.px;
        const dirx = targetX - ax;
        const step = Math.sign(dirx) * 0.6 * dt;
        duplicate.px += step;
        // when reached village edge -> end sequence
        if(Math.abs(duplicate.px - targetX) < 8){
          endSequence();
        }
      }
    }
  }

  let lastTime=0;
  function loop(t){
    if(!lastTime) lastTime = t;
    const dt = Math.min(40, t - lastTime) / 16; // normalize to ~60fps
    lastTime = t;
    update(dt);
    render();
    if(gameRunning) requestAnimationFrame(loop);
  }

  function render(){
    drawBackground();
    drawMap();
    // dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    // use composite to cut light circle where lantern is
    // draw player light by clearing a radial area
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = worldToScreen(player.px, player.py);
    const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, player.lantern);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, player.lantern, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // draw visible parts of map by redrawing map tiles inside lantern circle clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, player.lantern, 0, Math.PI*2);
    ctx.clip();
    drawMap();
    ctx.restore();

    // draw duplicate slightly visible only if near player's lantern
    const d = duplicate ? Math.hypot(duplicate.px - player.px, duplicate.py - player.py) : Infinity;
    if(d < player.lantern + 30){
      drawDuplicate();
    }

    drawPlayer();

    // subtle vignette
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0,0,WIDTH,30);
    ctx.fillRect(0,HEIGHT-30,WIDTH,30);
  }

  function triggerSwap(){
    swapped = true;
    gameRunning = true;
    // flash white then dark then start duplicate return
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.restore();
    // player gets stuck: immobilize by zeroing speed and lock input
    player.speed = 0;
    // duplicate becomes active "controller"
    duplicate.state = 'returning';
    // small delay then set duplicate to walk
    setTimeout(()=>{
      // duplicate will move in update()
      // also change background audio to eerie whisper spike
      if(audioOn && audioCtx){
        try{
          const g = audioCtx.createGain();
          g.gain.value = 0.12;
          g.connect(masterGain);
          // quick pulse via oscillator
          const o = audioCtx.createOscillator();
          o.frequency.value = 190;
          o.type = 'sine';
          const og = audioCtx.createGain();
          og.gain.value = 0.001;
          o.connect(og); og.connect(g);
          o.start();
          og.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime+0.12);
          og.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.9);
          setTimeout(()=>{ try{o.stop();}catch(e){}; }, 1100);
        }catch(e){}
      }
    }, 600);
  }

  function endSequence(){
    // stop ambient and show shock ending
    stopAmbient();
    // reveal final text and freeze
    gameRunning = false;
    // overlay final blackout and text
    ctx.fillStyle = 'rgba(0,0,0,0.98)';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = '#e6e6e6';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('في الصباح عاد... لكنّه لم يكن هو.', WIDTH/2, HEIGHT/2 - 14);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#d9a94b';
    ctx.fillText('دور ضحية جديدة...', WIDTH/2, HEIGHT/2 + 24);
    // small looping whisper effect using DOM to show change
    const endHint = document.getElementById('hint');
    if(endHint) endHint.textContent = 'انتهت الجولة — شاهد النهاية الصادمة';
  }

  // Attach play
  playBtn.addEventListener('click', ()=>{
    gameWrap.classList.remove('hidden');
    startGame();
  });

  // Resize handling
  window.addEventListener('resize', ()=>{ setupCanvas(); render(); });

  // initial layout
  setupCanvas();
  makeMap();
  generatePlayerPixelPos();
  render();

  // Expose for debug
  window.__game = { startGame, stopAmbient };
})();
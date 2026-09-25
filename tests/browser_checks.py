"""Regressiechecks: python3 tests/browser_checks.py

Vereist Python 3.9+, het Python-pakket playwright en Google Chrome.
De browser leest uitsluitend lokale spelbestanden; er is geen server nodig.
"""

from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:8765'


def serve_local(route):
    path = (ROOT / unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
    if path.is_dir():
        path = path / 'index.html'
    if path.is_file() and path.is_relative_to(ROOT):
        route.fulfill(path=str(path))
    else:
        route.fulfill(status=404, body='Not found')


with sync_playwright() as pw:
    browser = pw.chromium.launch(channel='chrome', headless=True)
    context = browser.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block',
    )
    context.route(ORIGIN + '/**', serve_local)
    # Laat de echte game-loop draaien met gecontroleerde schermtijdstippen.
    context.add_init_script('''
        window.__testTime=0;
        performance.now=()=>window.__testTime;
        Math.random=()=>0.5;
        window.requestAnimationFrame=cb=>{ window.__nextFrame=cb; return 1; };
        window.__frame=time=>{
            window.__testTime=time;
            const cb=window.__nextFrame;
            window.__nextFrame=null;
            cb(time);
        };
    ''')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(ORIGIN, wait_until='networkidle')
    page.evaluate('__frame(0)')
    assert not errors, errors
    assert page.evaluate('bgReady && atlasReady && sumoAtlas.naturalWidth>0')
    for index, char_id, name in [(0, 'rood', 'Koa'), (1, 'geel', 'Riku'), (2, 'turquoise', 'Nalu'), (3, 'paars', 'Mako')]:
        page.locator('.keuze-dot').nth(index).click()
        assert page.evaluate('selectedChar') == char_id
        assert name in page.locator('#kiesBtn').inner_text()
        assert page.locator('.keuze-kaart').nth(index).evaluate('(el)=>!el.inert')
    page.locator('.keuze-dot').nth(0).click()
    print('PASS: strand en sprite-atlas laden; alle vier personages zijn te kiezen')
    assert page.locator('#controls').is_hidden()
    page.locator('#kiesBtn').click()
    page.locator('.touch-help').wait_for(state='visible')
    assert 'veeg omhoog' in page.locator('.touch-help').inner_text()
    assert page.get_by_role('radio', name='Normaal', exact=True).is_checked()
    page.get_by_role('radio', name='Makkelijk', exact=True).check()
    assert 'Rustig inkomen' in page.locator('#difficultyHint').inner_text()
    page.get_by_role('radio', name='Moeilijk', exact=True).check()
    page.reload(wait_until='networkidle')
    page.locator('#kiesBtn').click()
    page.locator('#difficultyPicker').wait_for(state='visible')
    assert page.get_by_role('radio', name='Moeilijk', exact=True).is_checked()
    page.get_by_role('radio', name='Moeilijk', exact=True).focus()
    page.keyboard.press('ArrowLeft')
    assert page.get_by_role('radio', name='Normaal', exact=True).is_checked()
    assert page.evaluate("selectedDifficulty==='normal'")
    page.locator('#playBtn').click()
    assert page.locator('#controls').is_visible()
    assert 'Normaal' in page.locator('#matchLabel').text_content()
    print('PASS: niveaus kiezen met aanraking en toetsenbord; keuze blijft na herladen bewaard')

    profiles = page.evaluate('''()=>{
        const results={};
        const originalRandom=Math.random;
        Math.random=()=>.9;
        for(const level of Object.keys(difficulties)){
            selectedDifficulty=level; init(); running=true; serveMode=false;
            ball={x:300,y:330,vx:3,vy:1,spin:0};
            let observedAt=0;
            for(let step=0;step<30;step++){
                updateCPU();
                if(cpuSeenFlight===0){ observedAt=step; break; }
            }
            const error=cpuAimError, timing=cpuJumpError;
            for(let step=0;step<40;step++) updateCPU();
            const stable=error===cpuAimError && timing===cpuJumpError;
            ballFlight++; ball.vx=-5;
            for(let step=0;step<difficulties[level].reactionSteps;step++) updateCPU();
            const waited=cpuSeenFlight===0;
            updateCPU();
            const noticed=cpuSeenFlight===1;
            const stats=JSON.stringify({p1:p1.stats,p2:p2.stats});
            // Een nieuwe keuze mag de lopende wedstrijd niet aanpassen.
            selectedDifficulty=level==='easy'?'hard':'easy';
            const fixed=matchDifficulty===level;
            pauseGame();
            const paused=JSON.stringify({cpuTick,cpuHistory,cpuPlan});
            __frame(__testTime+5000);
            const frozen=paused===JSON.stringify({cpuTick,cpuHistory,cpuPlan});
            resumeGame();
            resetPositions();
            const reset=cpuHistory.length===0 && cpuPlan===null && cpuSeenFlight===-1;
            results[level]={observedAt,error,timing,stable,waited,noticed,stats,fixed,frozen,reset};
        }
        Math.random=originalRandom;
        selectedDifficulty='normal'; srv=0; init(); running=true;
        return results;
    }''')
    assert [profiles[level]['observedAt'] for level in ['easy', 'normal', 'hard']] == [21, 11, 5], profiles
    assert profiles['easy']['error'] > profiles['normal']['error'] > profiles['hard']['error'] > 0
    assert profiles['easy']['timing'] > profiles['normal']['timing'] > profiles['hard']['timing'] > 0
    assert len({profile['stats'] for profile in profiles.values()}) == 1
    for profile in profiles.values():
        assert all(profile[key] for key in ['stable', 'waited', 'noticed', 'fixed', 'frozen', 'reset']), profile
    print('PASS: echte reactievertraging, stabiele richt- en timingfouten, vaste stats en correct pauzeren/resetten')

    scenarios = page.evaluate((ROOT / 'tests/cpu_scenarios.js').read_text())
    assert scenarios['easy']['returns'] < scenarios['normal']['returns'] < scenarios['hard']['returns'], scenarios
    assert scenarios['hard']['smashes'] > scenarios['easy']['smashes'], scenarios
    assert all(result['total'] == 1024 and result['serves'] == 4 for result in scenarios.values()), scenarios
    print('PASS: 1.024 gelijke balbanen per niveau: meer geslaagde terugslagen bij hogere moeilijkheid;', scenarios)

    states = {}
    for hz in [30, 60, 120, 144]:
        states[hz] = page.evaluate('''hz=>{
            __testTime=0;
            srv=0;
            init();
            K.ArrowUp=true;
            running=true;
            for(let i=1;i<=hz*2;i++) __frame(i*1000/hz);
            return {p1,p2,ball,score,dead,deadT,serveMode};
        }''', hz)
    assert all(state == states[60] for state in states.values()), states
    print('PASS: gelijke speltoestand bij 30, 60, 120 en 144 Hz')

    steps = page.evaluate('''()=>{
        init(); running=true;
        let count=0;
        const originalUpdate=update;
        update=()=>{ count++; originalUpdate(); };
        __frame(__testTime+30000);
        update=originalUpdate;
        return count;
    }''')
    assert steps == 15, steps
    print('PASS: een lange onderbreking veroorzaakt geen enorme inhaalslag')

    collisions = page.evaluate('''()=>{
        const cases=[
            {name:'vertical',prev:[225,460],b:{x:225,y:490,vx:0,vy:30}},
            {name:'fastLeft',prev:[180,550],b:{x:270,y:550,vx:90,vy:0}},
            {name:'fastRight',prev:[300,550],b:{x:180,y:550,vx:-120,vy:0}},
            {name:'above',prev:[180,450],b:{x:270,y:450,vx:90,vy:0}},
            {name:'diagonal',prev:[180,460],b:{x:240,y:510,vx:60,vy:50}},
            {name:'overlap',prev:[225,510],b:{x:225,y:510,vx:0,vy:3}},
            {name:'away',prev:[199,550],b:{x:198,y:550,vx:-1,vy:0}},
        ];
        return Object.fromEntries(cases.map(c=>{
            resolveBallNet(c.b,...c.prev); return [c.name,c.b];
        }));
    }''')
    assert collisions['vertical']['y'] == 484 and collisions['vertical']['vy'] < 0
    assert collisions['fastLeft']['x'] == 199 and collisions['fastLeft']['vx'] < 0
    assert collisions['fastRight']['x'] == 251 and collisions['fastRight']['vx'] > 0
    assert collisions['above']['x'] == 270 and collisions['above']['vx'] == 90
    assert collisions['diagonal']['y'] == 484 and collisions['diagonal']['vy'] < 0
    assert collisions['overlap']['y'] == 484 and collisions['overlap']['vy'] < 0
    assert collisions['away']['x'] == 198 and collisions['away']['vx'] == -1
    assert page.evaluate('''()=>{
        init(); running=true;
        ball={x:225,y:481,vx:0,vy:5,spin:0};
        update();
        return ball.y===484 && ball.vy<0 && score[0]===0 && score[1]===0;
    }''')
    print('PASS: verticale, schuine en snelle botsingen met de paal')

    page.keyboard.down('ArrowRight')
    assert page.evaluate('p1R()')
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    assert page.evaluate("!running && !p1R() && menuMode==='pause'")
    before = page.evaluate('JSON.stringify({p1,p2,ball,score,deadT})')
    page.evaluate('__frame(__testTime+10000)')
    assert before == page.evaluate('JSON.stringify({p1,p2,ball,score,deadT})')
    page.keyboard.up('ArrowRight')
    page.locator('#playBtn').click()
    assert page.evaluate("running && !p1R() && menuMode==='playing'")
    page.evaluate('__frame(__testTime+8)')
    assert before == page.evaluate('JSON.stringify({p1,p2,ball,score,deadT})')
    page.keyboard.press('Escape')
    assert page.evaluate("menuMode==='pause' && !running")
    assert page.locator('#difficultyPicker').is_hidden()
    assert 'Niveau: Normaal' in page.locator('#menuContent').inner_text()
    page.keyboard.press('Escape')
    assert page.evaluate('running')
    page.evaluate('''()=>{
        Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
        document.dispatchEvent(new Event('visibilitychange'));
        resumeGame();
    }''')
    assert page.evaluate("!running && menuMode==='pause'")
    page.evaluate('delete document.hidden')
    page.locator('#playBtn').click()
    print('PASS: focusverlies, verborgen tab, pauzeren en hervatten zonder sprong in de tijd')

    def center(selector):
        box = page.locator(selector).bounding_box()
        return {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2}

    cdp = context.new_cdp_session(page)
    right = dict(center('[data-control="r"]'), id=1)
    jump = dict(center('#jumpBtn'), id=2)
    page.evaluate('init(); running=true;')
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [right, jump]})
    assert page.evaluate('buttonHeld.r && buttonHeld.j')
    page.evaluate('__frame(__testTime+34)')
    assert page.evaluate('p1.x>VW*.27 && !p1.grounded')
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchCancel', 'touchPoints': []})
    assert page.evaluate('!buttonHeld.r && !buttonHeld.j && controlPointers.size===0')
    page.evaluate('init(); running=true;')
    cdp.send('Input.dispatchTouchEvent', {
        'type': 'touchStart', 'touchPoints': [{'x': 100, 'y': 700, 'id': 3}],
    })
    cdp.send('Input.dispatchTouchEvent', {
        'type': 'touchMove', 'touchPoints': [{'x': 100, 'y': 590, 'id': 3}],
    })
    assert page.evaluate('p1J() && held1.l')
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    assert page.evaluate('!held1.l && !held1.r')
    point = center('[data-control="r"]')
    page.mouse.move(point['x'], point['y'])
    page.mouse.down()
    assert page.evaluate('buttonHeld.r')
    page.mouse.move(10, 10)
    page.mouse.up()
    assert page.evaluate('!buttonHeld.r')
    print('PASS: tegelijk lopen en springen, omhoog vegen, annuleren en buiten de knop loslaten')

    page.evaluate('''()=>{
        init(); running=true;
        score=[9,0];
        ball={x:400,y:GND()-BR()-1,vx:0,vy:3,spin:0};
        update();
    }''')
    page.wait_for_function("menuMode==='win'", polling=50)
    assert '10 - 0' in page.locator('.final').inner_text()
    assert page.locator('#difficultyPicker').is_hidden()
    page.locator('#playBtn').click()
    assert page.locator('#keuzescherm').evaluate('(el)=>!el.inert')
    page.locator('#kiesBtn').click()
    page.locator('#playBtn').click()
    assert page.evaluate('running && !over && score[0]===0 && score[1]===0')
    assert not errors, errors
    print('PASS: wedstrijd uitspelen en opnieuw starten; geen JavaScript-fouten')

    for width, height in [(390, 844), (320, 568), (844, 390), (1440, 900)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.evaluate('resize(); showKeuzescherm(); keuzescherm.scrollTop=0;')
        page.wait_for_timeout(300)
        layout = page.evaluate('''()=>{
            const rect=canvas.getBoundingClientRect();
            const button=kiesBtn.getBoundingClientRect();
            return {
                ratio:rect.width/rect.height,
                sharpness:canvas.width/rect.width,
                buttonFits:button.top>=rect.top && button.bottom<=rect.bottom
            };
        }''')
        assert abs(layout['ratio'] - 0.5) < 0.005, layout
        assert abs(layout['sharpness'] - 2) < 0.01, layout
        assert layout['buttonFits'], (width, height, layout)
        page.locator('#kiesBtn').click()
        page.evaluate('menu.scrollTop=0')
        for level in ['Makkelijk', 'Normaal', 'Moeilijk']:
            page.get_by_role('radio', name=level, exact=True).check()
            assert page.evaluate('''()=>{
                const rect=canvas.getBoundingClientRect();
                const button=playBtn.getBoundingClientRect();
                const picker=difficultyPicker.getBoundingClientRect();
                return picker.top>=rect.top && button.bottom<=rect.bottom;
            }'''), (width, height, level)
    print('PASS: correcte verhoudingen, scherp tekenbuffer en zichtbare keuzeknop op vier schermformaten')

    page.evaluate("localStorage.setItem('sumo-difficulty','ongeldig')")
    page.reload(wait_until='networkidle')
    assert page.evaluate("selectedDifficulty==='normal'")
    blocked_page = context.new_page()
    blocked_page.on('pageerror', lambda error: errors.append(str(error)))
    blocked_page.add_init_script('''
        Storage.prototype.getItem=()=>{throw new Error('Storage blocked');};
        Storage.prototype.setItem=()=>{throw new Error('Storage blocked');};
    ''')
    blocked_page.goto(ORIGIN, wait_until='networkidle')
    blocked_page.locator('#kiesBtn').click()
    blocked_page.get_by_role('radio', name='Makkelijk', exact=True).check()
    blocked_page.locator('#playBtn').click()
    assert blocked_page.evaluate("running && matchDifficulty==='easy'")
    blocked_page.close()
    print('PASS: ongeldige of geblokkeerde browseropslag verhindert het spelen niet')

    page.goto((ROOT / 'index.html').as_uri(), wait_until='load')
    page.wait_for_function('bgReady && atlasReady', polling=50)
    page.evaluate('__frame(0)')
    page.locator('#kiesBtn').click()
    page.locator('#playBtn').click()
    page.evaluate('__frame(34)')
    assert page.evaluate('running && bgReady && atlasReady')
    assert not errors, errors
    print('PASS: lokaal openen via index.html werkt met alle nieuwe illustraties')

    browser.close()

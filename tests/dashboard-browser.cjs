/* Verificação visual isolada: sessão e consultas simuladas, sem acessar contas reais. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results', 'dashboard');
const fixtures = [
    { id: 1, Nome: 'Posto Exemplo Centro', Endereço: 'Av. das Indústrias, 123', Cidade: 'Contagem', Estado: 'MG', lat: -19.935, lon: -44.043 },
    { id: 2, Nome: 'Posto Exemplo Avenida', Endereço: 'Av. Principal, 456', Cidade: 'Contagem', Estado: 'MG', lat: -19.913, lon: -44.015 },
    { id: 3, Nome: 'Posto Exemplo Norte', Endereço: 'Rodovia, km 220', Cidade: 'Belo Horizonte', Estado: 'MG', lat: -19.88, lon: -43.98 }
];
async function main() {
    fs.mkdirSync(output, { recursive: true });
    const profile = fs.mkdtempSync(path.join(output, 'chrome-'));
    const server = http.createServer((req, res) => {
        let file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const js = content => { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(content); };
        const json = content => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(content)); };
        if (file === '/api/postos') return json(fixtures);
        if (file === '/api/lojas') return json([]);
        if (file === '/api/geocodificar') return json([{ lat: '-19.96', lon: '-44.065', display_name: 'Contagem, MG — cenário de teste' }]);
        if (file === '/src/services/auth.js') return js(`window.RotaCombustivel.services.auth = {
            processarRecuperacao: async () => false, verificarSessao: async () => true,
            obterNomeUsuario: () => 'Olá, Isaias', usuarioTemNome: () => true,
            obterUsuarioId: () => 'f2dc8ed7-6063-4c2f-90df-95fd241892d3',
            obterToken: () => null, sair: () => { document.getElementById('painelPrincipal').hidden = true; document.getElementById('telaLogin').hidden = false; }
        };`);
        if (file === '/src/services/supabase.js') return js('/* API local no teste. */');
        if (file === '/') file = '/src_rota_e_combustivel.html';
        const resolved = path.resolve(root, '.' + file);
        if (!resolved.startsWith(root + path.sep) || !/^\/(src\/|assets\/|src_rota_e_combustivel.html$)/.test(file)) { res.writeHead(404); return res.end(); }
        try {
            let data = fs.readFileSync(resolved);
            if (file === '/src/config.js') data = Buffer.from(data.toString().replace(/supabaseUrl: '[^']*'/, "supabaseUrl: ''").replace(/supabaseAnonKey: '[^']*'/, "supabaseAnonKey: ''"));
            res.writeHead(200, { 'Content-Type': ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png' })[path.extname(file)] || 'text/plain' });
            res.end(data);
        } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir=' + profile,'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let socket;
    try {
        const portFile = path.join(profile, 'DevToolsActivePort');
        for (let i=0; !fs.existsSync(portFile); i++) { if (i>150) throw Error('Chrome não iniciou'); await new Promise(r=>setTimeout(r,100)); }
        const port = fs.readFileSync(portFile,'utf8').split('\n')[0];
        const targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
        socket = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
        await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
        const pending = new Map(); let id=0; const errors=[];
        const call = (method,params={}) => new Promise((resolve,reject)=>{
            const requestId=++id; const timer=setTimeout(()=>reject(Error('Timeout '+method)),20000);
            pending.set(requestId, result=>{clearTimeout(timer); result.error?reject(Error(result.error.message)):resolve(result.result);});
            socket.send(JSON.stringify({id:requestId,method,params}));
        });
        let routeMode='normal';
        socket.onmessage=async event=>{
            const msg=JSON.parse(event.data);
            if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
            if (msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
            if (msg.method==='Fetch.requestPaused') {
                const req=msg.params;
                const url=new URL(req.request.url);
                const points=url.pathname.split('/').pop().split(';').map(p=>p.split(',').map(Number));
                const station=fixtures.findIndex(p=>Math.abs(p.lon-points[1][0])<.001);
                const distances=routeMode==='states'?[120000,490000,580000]:[4200,12800,28600];
                const body=routeMode==='no-route'?{code:'NoRoute'}:{code:'Ok',routes:[{distance:distances[station],duration:600*(station+1),geometry:{type:'LineString',coordinates:[points[0],[points[0][0]+.009,points[0][1]+.007],[points[1][0]-.006,points[1][1]-.004],points[1]]}}]};
                await call('Fetch.fulfillRequest',{requestId:req.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
            }
        };
        const evaluate=async expression=>{
            const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
            if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
            return r.result.value;
        };
        const wait=async expression=>{
            for(let i=0;i<100;i++){if(await evaluate(expression))return; await new Promise(r=>setTimeout(r,100));}
            throw Error('Condição não atendida: '+expression);
        };
        await call('Page.enable'); await call('Runtime.enable');
        await call('Fetch.enable',{patterns:[{urlPattern:'https://router.project-osrm.org/*'}]});
        await call('Emulation.setDeviceMetricsOverride',{width:1536,height:1024,deviceScaleFactor:1,mobile:false});
        await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});
        await wait("document.getElementById('outAutonomiaSegura')?.textContent === '952 km' && !document.getElementById('btnGPS').disabled");
        assert.equal(await evaluate("document.getElementById('telaLogin').hidden"),true);
        assert.equal(await evaluate("document.querySelectorAll('#inpCapacidade').length"),1);
        await evaluate("document.getElementById('btnAtualizarDados').click()");
        assert.equal(await evaluate("document.getElementById('configuracoes').open"),true);
        assert.equal(await evaluate("document.activeElement.id"),'inpCapacidade');
        await evaluate("document.getElementById('inpNivel').value='0.50';document.getElementById('inpNivel').dispatchEvent(new Event('change'));document.getElementById('configuracoes').open=false");
        assert.equal(await evaluate("document.getElementById('outAutonomiaSegura').textContent"),'476 km');
        routeMode='states';
        await evaluate("document.getElementById('inpOrigem').value='Contagem';RotaCombustivel.controllers.localizador.buscarPostos()");
        assert.deepEqual(await evaluate("[...document.querySelectorAll('.posto-card')].map(e=>e.className)"),['posto-card status-success','posto-card status-warning','posto-card status-danger']);
        assert.equal(await evaluate("document.querySelectorAll('.map-marker').length"),3);
        assert.match(await evaluate("document.querySelector('.map-origin').getAttribute('title')"), /Origem da consulta/);
        await wait("document.querySelectorAll('.mapa-posto-rotulo').length===3");
        assert.deepEqual(await evaluate("[...document.querySelectorAll('.mapa-posto-rotulo > span')].map(e=>e.textContent)"),fixtures.map(p=>p.Nome));
        assert.equal(await evaluate("document.querySelectorAll('.leaflet-overlay-pane path').length"),3);
        await evaluate("document.getElementById('btnExpandirMapa').click()");
        assert.equal(await evaluate("document.getElementById('mapaRota').classList.contains('ampliado')"),true);
        await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',windowsVirtualKeyCode:27});
        assert.equal(await evaluate("document.getElementById('mapaRota').classList.contains('ampliado')"),false);
        routeMode='no-route';
        await evaluate("RotaCombustivel.controllers.localizador.buscarPostos()");
        assert.equal(await evaluate("document.querySelectorAll('.posto-card.status-success').length"),0);
        assert.equal(await evaluate("document.querySelectorAll('.leaflet-overlay-pane path').length"),0);
        await evaluate("document.getElementById('inpCapacidade').value='';RotaCombustivel.controllers.painel.calcular()");
        assert.equal(await evaluate("document.getElementById('outAutonomiaSegura').textContent"),'—');
        assert.equal(await evaluate("document.getElementById('gaugePercent').textContent"),'—');
        await evaluate("document.getElementById('inpCapacidade').value='560';RotaCombustivel.controllers.painel.calcular()");
        routeMode='normal';
        await evaluate("RotaCombustivel.controllers.localizador.buscarPostos()");
        // Os números e postos das capturas são identificados como dados de demonstração.
        await evaluate("document.querySelector('.painel-introducao').insertAdjacentHTML('beforeend','<p style=\"font-size:12px;color:#667085;margin-top:6px\">Prévia de teste · postos e trajetos ilustrativos</p>')");
        for(const width of [1536,1366,390]) {
            await call('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1024,deviceScaleFactor:1,mobile:width===390});
            await evaluate("window.scrollTo({top:0,behavior:'instant'})");
            await new Promise(r=>setTimeout(r,1200));
            const overflow=await evaluate("document.documentElement.scrollWidth > innerWidth");
            assert.equal(overflow,false,'Sem rolagem horizontal em '+width);
            const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(await evaluate("document.querySelector('.dashboard-grid').getBoundingClientRect().bottom+scrollY+16")),scale:1}});
            fs.writeFileSync(path.join(output,'painel-'+width+'.png'),Buffer.from(shot.data,'base64'));
        }

        // Coordenadas coincidentes devem mostrar todos os números e nomes, sem deslocar o cadastro.
        await call('Emulation.setDeviceMetricsOverride',{width:1366,height:1024,deviceScaleFactor:1,mobile:false});
        await evaluate("window.__postosSobrepostos = RotaCombustivel.postos.map((p,i,a)=>({...p,lat:i===2?a[1].lat:p.lat,lon:i===2?a[1].lon:p.lon,distancia:10,tipoDistancia:'ESTIMADA'}));RotaCombustivel.ui.mapa.exibir(window.__postosSobrepostos,{lat:-19.96,lon:-44.065},RotaCombustivel.ui.veiculo.lerParametros())");
        await wait("document.querySelector('.map-marker-grupo')");
        assert.equal(await evaluate("document.querySelector('.map-marker-numeros').textContent"),'2·3');
        await wait("document.querySelectorAll('.mapa-posto-rotulo').length===3");
        assert.equal(await evaluate("[...document.querySelectorAll('.mapa-posto-rotulo')].filter(e=>e.textContent.includes('Posto Exemplo')).length"),3);
        const coordenadas=await evaluate("JSON.stringify(window.__postosSobrepostos.map(p=>[p.lat,p.lon]))");
        await evaluate("document.querySelector('.map-marker-grupo').click()");
        await wait("document.querySelector('.leaflet-popup-content')");
        assert.match(await evaluate("document.querySelector('.leaflet-popup-content').textContent"),/2\. Posto Exemplo Avenida/);
        assert.match(await evaluate("document.querySelector('.leaflet-popup-content').textContent"),/3\. Posto Exemplo Norte/);
        assert.match(await evaluate("document.querySelector('.leaflet-popup-content').textContent"),/mesma coordenada/);
        await evaluate("document.querySelector('.leaflet-popup-close-button').click()");
        for (const width of [1366,390]) {
            await call('Emulation.setDeviceMetricsOverride',{width,height:1024,deviceScaleFactor:1,mobile:width===390});
            await new Promise(r=>setTimeout(r,300));
            assert.equal(await evaluate("document.querySelector('.map-marker-numeros').textContent"),'2·3');
        await wait("document.querySelectorAll('.mapa-posto-rotulo').length===3");
        assert.equal(await evaluate("[...document.querySelectorAll('.mapa-posto-rotulo')].filter(e=>e.textContent.includes('Posto Exemplo')).length"),3);
        }
        await call('Emulation.setDeviceMetricsOverride',{width:1366,height:1024,deviceScaleFactor:1,mobile:false});
        await new Promise(r=>setTimeout(r,500));
        const mapaClip=await evaluate("(()=>{const r=document.getElementById('mapaRota').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
        const sobrepostos=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:mapaClip});
        fs.writeFileSync(path.join(output,'mapa-postos-sobrepostos.png'),Buffer.from(sobrepostos.data,'base64'));
        assert.equal(await evaluate("JSON.stringify(window.__postosSobrepostos.map(p=>[p.lat,p.lon]))"),coordenadas);
        // Posições apenas próximas se separam ao ampliar o mapa.
        await evaluate("window.__postosSobrepostos[2].lon+=.0005;RotaCombustivel.ui.mapa.exibir(window.__postosSobrepostos,{lat:-19.96,lon:-44.065},RotaCombustivel.ui.veiculo.lerParametros())");
        assert.equal(await evaluate("document.querySelectorAll('.map-marker-grupo').length"),1);
        for(let i=0;i<8;i++) {
            await evaluate("document.querySelector('.leaflet-control-zoom-in').click()");
            await new Promise(r=>setTimeout(r,300));
        }
        await wait("document.querySelectorAll('.map-marker-grupo').length===0");
        assert.equal(await evaluate("document.querySelectorAll('.map-marker').length"),3);
        await wait("document.querySelectorAll('.mapa-posto-rotulo').length===3");
        assert.deepEqual(await evaluate("[...document.querySelectorAll('.mapa-posto-rotulo > span')].map(e=>e.textContent)"),fixtures.map(p=>p.Nome));
        await evaluate("RotaCombustivel.controllers.localizador.atualizarResultados()");
        await evaluate("document.getElementById('btnAbrirImportacao').click()");
        assert.equal(await evaluate("document.getElementById('modalImportacao').open"),true);
        await evaluate("document.getElementById('modalImportacao').close();document.getElementById('btnLogout').click()");
        assert.equal(await evaluate("document.getElementById('telaLogin').hidden"),false);
        await evaluate("RotaCombustivel.ui.mapa.exibir([],{lat:NaN,lon:-44},{})");
        assert.equal(await evaluate("document.querySelectorAll('.map-marker, .map-origin').length"),0);
        assert.equal(await evaluate("document.getElementById('mapaVazio').hidden"),false);
        assert.deepEqual(errors,[]);
        console.log('OK: cálculos, edição, três estados, ausência de rota, marcadores sobrepostos e próximos, mapa, modal, saída e larguras 1536/1366/390.');
        console.log('Capturas: '+output);
    } finally {
        socket?.close(); chrome.kill(); await new Promise(resolve=>server.close(resolve));
    }
}
main().catch(e=>{console.error(e);process.exitCode=1;});

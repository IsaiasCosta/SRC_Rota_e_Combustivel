const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { criarServidor } = require('../scripts/server.cjs');

async function main() {
    const root = path.resolve(__dirname, '..');
    const html = 'painel-iveco-tector.html';
    const server = criarServidor();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'iveco-browser-'));
    const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let socket;
    try {
        chrome.on('error', error => { console.error(error.message); });
        const portFile = path.join(profile, 'DevToolsActivePort');
        const deadline = Date.now() + 20000;
        while (!fs.existsSync(portFile)) {
            if (Date.now() > deadline) throw new Error('Chrome não iniciou em 20 segundos.');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
        const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
        let nextId = 0;
        const pending = new Map();
        const errors = [];
        socket.onmessage = event => {
            const msg = JSON.parse(event.data);
            if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
            if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
        };
        const call = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++nextId;
            const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000);
            pending.set(id, result => { clearTimeout(timer); result.error ? reject(new Error(result.error.message)) : resolve(result.result); });
            socket.send(JSON.stringify({ id, method, params }));
        });
        const evaluate = async expression => {
            const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
            return result.result.value;
        };
        await call('Runtime.enable');
        await call('Page.enable');
        await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 1000, deviceScaleFactor: 1, mobile: false });
        await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
        for (let i = 0; i < 100; i++) {
            if (await evaluate("document.getElementById('outAutonomiaSegura')?.textContent === '952.0 km'")) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(await evaluate("document.getElementById('outAutonomiaSegura').textContent"), '952.0 km');
        assert.equal(await evaluate("document.querySelectorAll('input[id^=\"inpCapacidade\"]').length"), 1);
        assert.equal(await evaluate("getComputedStyle(document.body).backgroundColor"), 'rgb(8, 10, 16)');
        assert.equal(await evaluate("document.querySelector('.brand-mark img').decode().then(() => document.querySelector('.brand-mark img').naturalWidth > 0)"), true);
        assert.equal(await evaluate("document.body.textContent.includes('from pathlib')"), false);
        assert.equal(await evaluate("IvecoTector.utils.formatarTempo(119.6)"), '2h 0min');
        assert.equal(await evaluate("document.querySelectorAll('input:not([id]), select:not([id])').length"), 0);
        await evaluate("document.getElementById('inpCarga').value='VAZIO'; document.getElementById('inpCarga').dispatchEvent(new Event('change'))");
        assert.equal(await evaluate("document.getElementById('outAutonomiaSegura').textContent"), '1428.0 km');
        await evaluate("document.getElementById('inpConsumo').value='2.7'; document.getElementById('inpConsumo').dispatchEvent(new Event('input'))");
        assert.equal(await evaluate("document.getElementById('outAutonomia').textContent"), '1512.0 km');
        await call('Page.reload');
        for (let i = 0; i < 100; i++) {
            if (await evaluate("document.getElementById('outAutonomia')?.textContent === '1512.0 km'")) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(await evaluate("document.getElementById('inpConsumo').value"), '2.7');
        await evaluate(`window.fetch = async url => ({ok:true,json:async()=>String(url).includes('nominatim')?[{lat:'-19.9',lon:'-44.0',display_name:'Contagem, MG'}]:{code:'Ok',routes:[{distance:50000,duration:3590}]}}); document.getElementById('inpOrigem').value='Contagem'; document.getElementById('btnBuscarCidade').click()`);
        for (let i = 0; i < 100; i++) {
            if (await evaluate("!document.getElementById('btnBuscarCidade').disabled")) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(await evaluate("document.querySelectorAll('#resultadosPostos li').length"), 5);
        assert.equal(await evaluate("document.querySelectorAll('#resultadosPostos a[href*=\"/maps/search/\"]').length"), 5);
        assert.equal(await evaluate("[...document.querySelectorAll('#resultadosPostos a[href*=\"/maps/dir/\"]')].every(a => {const url=new URL(a.href); return /^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$/.test(url.searchParams.get('destination')) && url.searchParams.get('origin') === '-19.9,-44';})"), true);
        assert.equal(await evaluate("document.querySelector('#resultadosPostos .status-success') !== null"), true);
        await evaluate("document.getElementById('inpNivel').value='0'; document.getElementById('inpNivel').dispatchEvent(new Event('change'))");
        assert.equal(await evaluate("document.querySelectorAll('#resultadosPostos .status-danger').length"), 5);
        assert.equal(await evaluate("document.getElementById('outAutonomia').textContent"), '0.0 km');
        await evaluate("document.getElementById('inpConsumo').value=''; document.getElementById('inpConsumo').dispatchEvent(new Event('input'))");
        assert.equal(await evaluate("document.getElementById('outAutonomia').textContent"), '—');
        assert.equal(await evaluate("document.getElementById('resultadosPostos').textContent.includes('NaN')"), false);
        await evaluate(`document.getElementById('inpConsumo').value='2'; document.getElementById('inpNivel').value='1.00'; IvecoTector.controllers.painel.calcular(); window.fetch=async url=>{if(String(url).includes('nominatim')) return {ok:true,json:async()=>[{lat:'-19.9',lon:'-44.0',display_name:'Contagem, MG'}]}; throw new Error('Sem conexão')}; IvecoTector.controllers.localizador.buscarPostos()`);
        assert.equal(await evaluate("(document.getElementById('resultadosPostos').textContent.match(/📏 estimativa/g)||[]).length"), 5);
        await evaluate("window.fetch=async()=>{throw new Error('Sem conexão')}; IvecoTector.controllers.localizador.buscarPostos()");
        assert.equal(await evaluate("document.getElementById('statusBusca').textContent"), 'Sem conexão');
        assert.equal(await evaluate("document.getElementById('btnGPS').disabled || document.getElementById('btnBuscarCidade').disabled"), false);
        await evaluate("window.fetch=async url=>({ok:true,json:async()=>String(url).includes('nominatim')?[{lat:'-19.9',lon:'-44.0',display_name:'Contagem, MG'}]:{code:'Ok',routes:[{distance:null,duration:30}]}}); IvecoTector.controllers.localizador.buscarPostos()");
        assert.equal(await evaluate("(document.getElementById('resultadosPostos').textContent.match(/📏 estimativa/g)||[]).length"), 5);
        // Um cadastro anterior deve manter os litros e a autonomia após a migração.
        await evaluate("localStorage.setItem(IvecoTector.config.storageKey, JSON.stringify({inpCapacidade1:'100',inpCapacidade2:'500',inpNivel:'0.50',inpConsumo:'2',inpMargem:'0.15',inpCarga:'CARREGADO'}))");
        await call('Page.reload');
        for (let i = 0; i < 100; i++) {
            if (await evaluate("document.getElementById('outAutonomiaSegura')?.textContent === '510.0 km'")) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(await evaluate("document.getElementById('inpCapacidade').value"), '600');
        assert.equal(await evaluate("document.getElementById('outLitros').textContent"), '300.0 L');
        assert.equal(await evaluate("document.getElementById('outAutonomiaSegura').textContent"), '510.0 km');
        assert.equal(await evaluate("Object.hasOwn(JSON.parse(localStorage.getItem(IvecoTector.config.storageKey)), 'inpCapacidade2')"), false);
        await evaluate("document.getElementById('inpCapacidade').value='100'; document.getElementById('inpNivel').value='1.00'; document.getElementById('inpCapacidade').dispatchEvent(new Event('input'))");
        assert.equal(await evaluate("document.getElementById('outAutonomia').textContent"), '200.0 km');
        await call('Page.reload');
        for (let i = 0; i < 100; i++) {
            if (await evaluate("document.getElementById('outAutonomia')?.textContent === '200.0 km'")) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(await evaluate("document.getElementById('inpCapacidade').value"), '100');
        for (const valor of ['', '0', '-100']) {
            await evaluate(`document.getElementById('inpCapacidade').value=${JSON.stringify(valor)}; document.getElementById('inpCapacidade').dispatchEvent(new Event('input'))`);
            assert.equal(await evaluate("document.getElementById('outAutonomia').textContent"), '—');
            assert.equal(await evaluate("JSON.parse(localStorage.getItem(IvecoTector.config.storageKey)).inpCapacidade"), '100');
        }
        await evaluate("document.getElementById('inpCapacidade').value='600'; document.getElementById('inpNivel').value='0.50'; document.getElementById('inpCapacidade').dispatchEvent(new Event('input'))");
        for (const width of [1366, 768, 390, 320]) {
            await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 700 });
            assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `Layout excedeu a tela em ${width}px`);
            if (width === 1366 || width === 390) {
                const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                fs.writeFileSync(path.join(profile, `painel-${width}.png`), Buffer.from(screenshot.data, 'base64'));
            }
        }
        await call('Page.navigate', { url: pathToFileURL(path.join(root, html)).href });
        for (let i = 0; i < 100; i++) {
            if (await evaluate("document.getElementById('outAutonomiaSegura')?.textContent === '952.0 km'")) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(await evaluate("document.getElementById('outAutonomiaSegura').textContent"), '952.0 km');
        assert.equal(await evaluate("getComputedStyle(document.body).backgroundColor"), 'rgb(8, 10, 16)');
        assert.equal(await evaluate("document.querySelectorAll('[onclick],[oninput],[onchange]').length"), 0);
        assert.deepEqual(errors, []);
        console.log('OK: CSS, cálculos, consumo editável, persistência, busca simulada, atualização dos avisos, falha de rede, rota inválida e layout em 4 larguras.');
        console.log(`Capturas: ${profile}`);
        console.log('OK: abertura direta do HTML e eventos separados da marcação.');
        console.log('OK: um único campo de tanque, migração dos valores antigos, capacidades de 100 e 600 L, e rejeição de capacidade inválida.');
    } finally {
        if (socket?.readyState === WebSocket.OPEN) socket.close();
        chrome.kill();
        server.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

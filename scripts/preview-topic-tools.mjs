// Isolated manual acceptance server. No production configuration, credentials,
// proxying or persistent business data. Stop with Ctrl-C after acceptance.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import { componentSource, componentWindow, topicMetadata } from '../tests/helpers/topic-fixture.mjs';

const port = Number(process.env.LDSP_TOPIC_PREVIEW_PORT || 18773);
const chunkDelay = Number(process.env.LDSP_TOPIC_PREVIEW_DELAY_MS || 80);
const fixture = componentWindow();
const css = fixture.window.Styles._css({ width: 380, maxHeight: 780, top: 72, fontSize: 14, padding: 12, avatarSize: 40, ringSize: 60 });
fixture.dom.window.close();
let requests = 0;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const send = (type, body, status = 200) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
    if (url.pathname === '/LDStatusPro.user.js') { send('text/javascript; charset=utf-8', fs.readFileSync(new URL('../LDStatusPro.user.js', import.meta.url))); return; }
    if (url.pathname === '/fixture.png') { send('image/png', png); return; }
    if (url.pathname === '/fixture.css') { send('text/css', css + '#ldsp-panel{height:780px}.fixture-nav{display:flex;gap:12px;margin:12px}body{font:16px sans-serif}#panel-body{position:relative;flex:1;min-height:0}'); return; }
    const capture = url.pathname.match(/^\/capture-(light|dark)-(reqs|trends)$/);
    if (capture) { send('text/html', `<!doctype html><html><style>html,body{margin:0;background:white;width:2880px;height:1800px}iframe{width:1440px;height:900px;border:0;display:block;transform:scale(2);transform-origin:top left}</style><iframe src="/plugin-${capture[1]}-${capture[2]}.html"></iframe></html>`); return; }
    const preview = url.pathname.match(/^\/plugin-(light|dark)-(reqs|trends)\.html$/);
    if (preview) { send('text/html; charset=utf-8', fs.readFileSync(new URL(`../website/public/product-preview/plugin-${preview[1]}-${preview[2]}.html`, import.meta.url))); return; }
    if (url.pathname === '/fixture.js') {
        send('text/javascript; charset=utf-8', `
            const values = new Map([['ldsp_melon_config', JSON.stringify({apiUrl:location.origin, model:'fixture'})]]);
            const GM_getValue = (key, fallback) => values.get(key) ?? fallback, GM_setValue = (key,value) => values.set(key,value);
            const Utils = {escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]),hexToRgb:()=>({r:0,g:0,b:0})};
            const Logger={log(){},error(){},warn(){}}, UI={empty:({text})=>text};
            function GM_xmlhttpRequest(options){
                const controller=new AbortController();
                fetch(options.url,{method:options.method,headers:options.headers,body:options.data,signal:controller.signal}).then(async response=>{
                    if(options.responseType==='blob'){options.onload({status:response.status,response:await response.blob()});return;}
                    const reader=response.body.getReader(),decoder=new TextDecoder();let text='';
                    while(true){const {done,value}=await reader.read();if(done)break;text+=decoder.decode(value,{stream:true});options.onprogress?.({status:response.status,responseText:text});}
                    options.onload({status:response.status,responseText:text});
                }).catch(error=>error.name==='AbortError'?options.onabort?.():options.onerror?.());
                return{abort(){controller.abort()}};
            }
            ${componentSource()}
            const panel=document.querySelector('#panel-body'),renderer={showToast:message=>document.querySelector('#toast').textContent=message};
            const exporter=new TopicExporter(panel,renderer),helper=new MelonHelper(panel,renderer);exporter.init();helper.init();
            document.querySelector('#open-export').onclick=()=>{helper.hide();exporter.show()};
            document.querySelector('#open-ai').onclick=()=>{exporter.hide();helper.show()};
            document.querySelector('#theme').onclick=()=>document.querySelector('#ldsp-panel').classList.toggle('light');
            document.querySelector('#narrow').onclick=()=>{document.querySelector('#ldsp-panel').style.width='300px';document.querySelector('#ldsp-panel').style.minWidth='0';};
            const preview=new URLSearchParams(location.search);
            if(preview.get('theme')==='dark')document.querySelector('#ldsp-panel').classList.remove('light');
            if(preview.get('tool')==='ai')helper.show();else exporter.show();
        `); return;
    }
    if (url.pathname === '/t/42.json') { send('application/json', JSON.stringify(topicMetadata)); return; }
    if (url.pathname === '/t/42/posts.json') {
        const after = Number(url.searchParams.get('post_number'));
        const posts = [1, 3, 5, 6, 8, 9, 10].filter(number => number > after).slice(0, 3).map(number => topicMetadata.post_stream.posts.find(post => post.post_number === number) || ({ ...topicMetadata.post_stream.posts[1], id: number, post_number: number, cooked: `<p>第${number}楼示例内容。</p>` }));
        send('application/json', JSON.stringify({ post_stream: { posts } })); return;
    }
    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1000000) { res.writeHead(413); res.end(); return; } }
        let data; try { data = JSON.parse(body); } catch { send('application/json', '{}', 400); return; }
        requests++;
        console.log(JSON.stringify({ request: requests, host: req.headers.host, model: data.model, messages: data.messages?.length, authorizationPresent: Boolean(req.headers.authorization), stream: data.stream }));
        const check = data.messages?.length === 1 && data.messages[0].content === '请仅回复 OK。';
        const floors = [...new Set([...body.matchAll(/第(\d+)楼/g)].map(match => Number(match[1])))].slice(0, 3);
        const text = check ? 'OK' : `## 本地模拟服务验收\n\n本次只验证 HTTP 请求、来源链接和交互，不代表真实模型总结质量。${floors.map(number => `[第${number}楼]`).join(' ')}\n\n|项目|结果|\n|---|---|\n|请求链路|已收到|\n|密钥|可留空|\n\n- **正常内容**\n  - 嵌套列表\n\n\`\`\`js\nconsole.log('fixture');\n\`\`\`\n`;
        if (!data.stream || data.model === 'json') { send('application/json', JSON.stringify({ choices: [{ message: { content: text }, finish_reason: 'stop' }] })); return; }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
        const parts = Array.from(text); let index = 0;
        const timer = setInterval(() => {
            if (res.destroyed) { clearInterval(timer); return; }
            const content = parts.slice(index, index + 20).join(''); index += 20;
            if (content) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\r\n\r\n`);
            else { res.end('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]'); clearInterval(timer); }
        }, data.model === 'slow' ? 1000 : chunkDelay);
        res.on('close', () => clearInterval(timer)); return;
    }
    if (url.pathname === '/t/42') { send('text/html; charset=utf-8', '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LDStatusPro 隔离验收</title><link rel="stylesheet" href="/fixture.css"><div class="fixture-nav"><button id="open-export">导出</button><button id="open-ai">总结</button><button id="theme">浅深主题</button><button id="narrow">窄屏面板</button><span id="toast"></span></div><main id="ldsp-panel" class="light"><div id="panel-body" class="ldsp-body"></div></main><script src="/fixture.js"></script></html>'); return; }
    send('text/plain', 'Not found', 404);
});
server.listen(port, '0.0.0.0', () => {
    const addresses = Object.values(os.networkInterfaces()).flat().filter(value => value.family === 'IPv4' && !value.internal).map(value => value.address);
    console.log(`Isolated fixture: http://127.0.0.1:${port}/t/42`);
    console.log(`LAN HTTP endpoints: ${addresses.map(address => `http://${address}:${port}/v1`).join(', ')}`);
});

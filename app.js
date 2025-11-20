import { App } from './app_helper.js';
import { readFileSync } from 'fs';
import fs from 'fs';
const config = JSON.parse(readFileSync(process.cwd() + '/config.json', 'utf8'));
const app = new App(config);
import ophook from './mods/ophook.js';
if (typeof (ophook) == 'function')
    ophook(app);
else
    console.error('Plugin ophook doesn`t export function');

if (config.admin_key) {
    const admin = (await import('./mods/admin.js')).default;
    if (typeof (admin) == 'function')
        admin(app);
    else
        console.error('Plugin admin doesn`t export function');
}

app.messengers = {};
for (let mes of fs.readdirSync('./messengers'))
{
    if (mes.substring(mes.lastIndexOf('.') + 1) == 'js') {
        const m = await import('./messengers/' + mes);
        const n = mes.split('.')[0];
        app.messengers[n] = m;
        console.log('messenger ' + n + ' loaded');
    }
}

app.actions = {};
for (let act of fs.readdirSync('./actions')) {
    if (act.substring(act.lastIndexOf('.') + 1) == 'js') {
        const a = (await import('./actions/' + act)).default;
        const n = act.split('.')[0];
        app.actions[n] = a;
        console.log('action ' + n + ' loaded');
    }
}

import op from './api/open-project.js'
(async () => {
    let list = await op.getTasks(config, 30, [{ "status": { "operator": "c" } }]);
    for (let o of list) {
        const actres = await app.actions['check_request_attached'].default(config, { task_id: o.id, project: { git_id: 91 } });
        console.log(o.id + " " + JSON.stringify(actres));
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
})();

app.Start();
import { App } from './app_helper.js';
import { readFileSync } from 'fs';
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

app.Start();
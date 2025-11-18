import express from 'express';
const router = express.Router();
import fs from 'fs';

export default (app) => {
    app.server.use('/' + app.config.admin_key, router);
    router.get('/ophook_admin', async (req, res) => {
        let f = fs.readFileSync('./admin.html', 'utf8');
        f = f.replace('<!--INITIAL-DATA!-->', '<script>' + 'const schema = ' + fs.readFileSync(process.cwd() + '/schema.json', 'utf8') + ';' +
            'const data = ' + JSON.stringify(app.config) + ';</script>');
        res.send(f);
    });

    router.post('/ophook_admin', async (req, res) => {
        let body = req.body;
        if (body) {
            fs.renameSync(process.cwd() + '/config.json', process.cwd() + '/config.json.bak');
            fs.writeFileSync(process.cwd() + '/config.json', JSON.stringify(body, null, 4));
        }
    });

    router.get('/ophook_admin', async (req, res) => {
        let f = fs.readFileSync('./admin.html', 'utf8');
        f = f.replace('<!--INITIAL-DATA!-->', '<script>' + 'const schema = ' + fs.readFileSync(process.cwd() + '/schema-schema.json', 'utf8') + ';' +
            'const data = ' + fs.readFileSync(process.cwd() + '/schema.json', 'utf8') + ';</script>');
        res.send(f);
    });
}
import axios from 'axios';
import op from '../api/open-project.js';

//subject
//description { format, raw, html }
//watchers
//assignee

const cache = {};
/**
 * Dictionary<id,{name,#color,isClosed,position}>
 */
const statuses = {};

async function logicInit(config)
{
    const list = await op.getStatuses(config);

    if (Array.isArray(list)) {
        for (let st of list) {
            statuses[st.id] = st;
        }
    }
    else if (list.error)
        console.error(list.error);

    for (let project of config.projects) {
        const proj = project.op_id;
        if (!proj) continue;
        const list = await op.getTasks(config, proj)
        if (Array.isArray(list)) {
            for (let wp of list) {
                let status = wp._links?.status;
                let st = status.href;
                if (st.indexOf('/') >= 0)
                    st = parseInt(st.substr(st.lastIndexOf('/') + 1));
                const assignee = wp._links?.assignee;
                let ass = assignee?.href;
                if (ass != null && ass.indexOf('/') >= 0)
                    ass = parseInt(ass.substr(ass.lastIndexOf('/') + 1));
                cache[wp.id] = { status: st, status_title: status.title, assignee: ass, assignee_title: assignee?.title, project: proj };
            }
            console.log('Loaded to cache ' + list.length + ' work packages of project ' + proj);
        }
        else
            console.log('Cannot read work packages of project ' + proj);   
    }
}

export default async (app) => {
    logicInit(app.config);

    var config = app.config;

    app.server.all('/ophook', async(req, res) =>
    {
        let b = req.body.work_package;
        if (b == null) { res.send(''); return; }
        
        const p_id = req.body.work_package._embedded.project.id;
        const project = config.projects.find(p => p.op_id == p_id);
        if (!project) 
        {
            console.log('Project with id ' + p_id + " not configured");
            return;
        }

        let target = project.target;
        if (!target)
        {
            for (let mes of Object.keys(app.messengers))
                if (project.webhook.indexOf(mes) >= 0) {
                    target = mes;
                    break;
                }
        }
        const status_title = b._links?.status?.title;
        console.log('Received ' + req.body.action + ' for ' + b.id + ' status: ' + status_title);
        
        let status = b._links?.status?.href;
        if (status.indexOf('/') >= 0)
            status = parseInt(status.substr(status.lastIndexOf('/') + 1));
        const closed = status == config.op_status_closed;

        const assignee = b._links?.assignee?.title;
        let ass = b._links?.assignee?.href;
        if (ass != null && ass.indexOf('/') >= 0)
            ass = parseInt(ass.substr(ass.lastIndexOf('/') + 1));

        function UserLink(u) {
            if (config.users[u] && app.messengers[target])
            {
                return app.messengers[target].userLink(config.users[u]);
            }
            return 'OP_USER_' + u;
        }

        const fields = [];
        let notify = '';
        if (!cache[b.id]) cache[b.id] = {};
        const status_prev = cache[b.id]?.status;
        if (status != status_prev)
        {
            console.log('Status update from ' + cache[b.id].status_title + ' to ' + status_title);
            fields.push( { name : 'Status', value : cache[b.id].status_title + ' -> ' + status_title });
            cache[b.id].status = status;
            cache[b.id].status_title = status_title;
        }
        if (ass != cache[b.id]?.assignee)
        {
            console.log('Assignee update from ' + (cache[b.id]?.assignee_title??'none') + ' to ' + assignee);
            fields.push( { name : 'Assignee', value : (cache[b.id]?.assignee_title??'none') + ' -> ' + assignee });
            cache[b.id].assignee = ass;
            cache[b.id].assignee_title = assignee;
            if (config.users[ass] && !closed)
                notify += UserLink(ass);
        }
        else if (fields.length > 0)
            fields.push( { name : 'Assignee', value : assignee });

        if (fields.length > 0)
        {
            let header = '';
            for (let rule of config.rules)
            {
                if (Array.isArray(rule.status) && rule.status.indexOf(status) >= 0 || rule.status == status)
                {
                    if (!rule.status_from || rule.status_from == status_prev || Array.isArray(rule.status_from) && rule.status_from.indexOf(status_prev) >= 0) {
                        header += rule.template.replace('{task.id}', b.id); // TODO: process markup by messenger module

                        if (rule.action)
                        {
                            const aa = app.actions[rule.action];
                            if (aa) {
                                const answer = aa(config, { task_id: b.id, project : project });
                                if (answer.message)
                                    header += answer.message;
                                if (answer.error)
                                    console.error('Action ' + rule.action + ' error: ' + answer.error);
                            }
                        }
                        if (project.tag_by_status && project.tag_by_status[status]) {
                            for (let u of project.tag_by_status[status]) {
                                notify += UserLink(u) + ' ';
                            }
                        }
                    }
                }
            }

            if (!header)
            {
                header = config.rules.find(r => !r.status).template.replace('{task.id}', b.id);
            }
            
            let link = config.op_host + '/work_packages/' + b.id + '/activity'
            let str = header + '\n' + b.subject + '\n' + link + ' ' + notify;
            const content = app.messengers[target].prepareMessage(project, str);
            await axios.post(project.webhook, content);
        }

        res.status(200).send('ok');
    });

    /*const fs = require('fs');
    const ejs = require('easy-json-schema');
    const jsonSchema = ejs(app.config);
    fs.writeFileSync(process.cwd() + '/schema.json', JSON.stringify(jsonSchema));*/
}
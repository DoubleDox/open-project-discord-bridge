import axios from 'axios';

//subject
//description { format, raw, html }
//watchers
//assignee

function HEXToVBColor(rrggbb, start) {
    let st = start ?? 0;
    var bbggrr = rrggbb.substr(4 + st, 2) + rrggbb.substr(2 + st, 2) + rrggbb.substr(st, 2);
    return parseInt(bbggrr, 16);
}

var cache = {};

async function logicInit(config)
{
    for (let project of config.projects)
    {
        const proj = project.op_id;
        if (!proj) continue;
        try
        {
            const res = await axios.get(config.op_host + '/api/v3/projects/' + proj + '/work_packages?filters=[{"status":{"operator":"o"}}]&pageSize=500', { auth: config.op_auth });
            const list = res.data._embedded?.elements;
            if (list != null)
            {
                for (let wp of list)
                {
                    let status = wp._links?.status;
                    let st = status.href;
                    if (st.indexOf('/') >= 0)
                        st = parseInt(st.substr(st.lastIndexOf('/') + 1));
                    const assignee = wp._links?.assignee;
                    let ass = assignee?.href;
                    if (ass != null && ass.indexOf('/') >= 0)
                        ass = parseInt(ass.substr(ass.lastIndexOf('/') + 1));
                    cache[wp.id] = { status : st, status_title : status.title, assignee : ass, assignee_title : assignee?.title };
                }
                console.log('Loaded to cache ' + list.length + ' work packages of project ' + proj);
            }
        }
        catch(exc)
        {
            console.log(exc.response?.data ?? exc);
        }
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

        let fields = [];
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
            let created = req.body.action == 'work_package:created';
            const message = { username :  'OP Bot', color: HEXToVBColor(b._embedded?.status?.color) }; // title = ''
            message.fields = fields;
            let header = '';

            for (let rule of config.rules)
            {
                if (Array.isArray(rule.status) && rule.status.indexOf(status) >= 0 || rule.status == status)
                {
                    if (!rule.status_from || rule.status_from == status_prev || Array.isArray(rule.status_from) && rule.status_from.indexOf(status_prev) >= 0) {
                        header += rule.template.replace('{task.id}', b.id); // TODO: process markup by messenger module

                        if (rule.action == 'check_request_attached' && config.git_host) {
                            if (config.git_host) {
                                try {
                                    let resp = await axios.get(config.op_host + '/api/v3/work_packages/' + b.id + '/activities', { auth: config.op_auth });
                                    let list = resp.data?._embedded?.elements;
                                    let mergeRequest = false;
                                    if (list != null && config.git_host != null) {
                                        for (let el of list) {
                                            if (el._type == 'Activity::Comment' && el.comment != null) {
                                                if (el.comment.raw.indexOf(config.git_host) >= 0)
                                                    mergeRequest = el.comment.raw.trim();
                                            }
                                        }
                                    }
                                    console.log(mergeRequest);
                                    if (!mergeRequest)
                                        header += config.actions?.check_request_attached?.message ?? ' ⚠️ No request specified ⚠️';
                                    else {
                                        const resp = await axios.get(config.git_host + '/api/v4/projects/' + project.git_id + '/merge_requests/1/changes', { headers: { 'PRIVATE-TOKEN': 'xzVt4EP_4quzfwUjgW_Q' } });
                                        console.log(resp);
                                        
                                        //resp.data.diff_refs.head_sha - last commit in branch
                                        //resp.data.diff_refs.base_sha   |
                                        //resp.data.diff_refs.start_sha  |- base commit in develop to compared with?
                                        //resp.data.changes = []
                                        //-- old_path, new_path
                                    }
                                }
                                catch (exc) {
                                    console.error('Cannot fetch comments of ' + b.id + ': ' + exc);
                                }
                            }
                            else
                                console.error('git host not setup for action ' + rule.action);
                        }

                        if (project.tag_by_status && project.tag_by_status[status]) {
                            for (let u of project.tag_by_status[status]) {
                                notify += UserLink(u);
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
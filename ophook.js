const version = '0.3.3';
const axios = require('axios');

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
{//ssr-vragh-iz-budushchiegho
    for (let project of config.projects)
    {
        let proj = project.op_id;
        if (proj == null) continue;
        try
        {
            let res = await axios.get(config.op_host + '/api/v3/projects/' + proj + '/work_packages?filters=[{"status":{"operator":"o"}}]&pageSize=500', { auth: config.op_auth });
            let list = res.data._embedded?.elements;
            if (list != null)
            {
                for (let wp of list)
                {
                    let status = wp._links?.status;
                    let st = status.href;
                    if (st.indexOf('/') >= 0)
                        st = parseInt(st.substr(st.lastIndexOf('/') + 1));
                    let assignee = wp._links?.assignee;
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

exports.Init = (app) =>
{
    logicInit(app.config);

    var config = app.config;

    app.server.all('/ophook', async(req, res) =>
    {
        let b = req.body.work_package;
        if (b == null) { res.send(''); return; }
        // b.action = work_package:updated'
        //console.log(b);
        //console.log(b.watchers);
        let p_id = req.body.work_package._embedded.project.id;
        let project = config.projects.find(p => p.op_id == p_id);
        if (project == null) 
        {
            console.log('Project with id ' + p_id + " not configured");
            return;
        }

        let target = null;
        if (project.webhook.indexOf('discord') >= 0) target = 'discord';
        if (project.webhook.indexOf('telegram') >= 0) target = 'telegram';
        let status = b._links?.status?.title;
        console.log('Received ' + req.body.action + ' for ' + b.id + ' status: ' + status);
        let st = b._links?.status?.href;
        if (st.indexOf('/') >= 0)
            st = parseInt(st.substr(st.lastIndexOf('/') + 1));

        let closed = st == config.op_status_closed;
            
        let assignee = b._links?.assignee?.title;
        let ass = b._links?.assignee?.href;
        if (ass != null && ass.indexOf('/') >= 0)
            ass = parseInt(ass.substr(ass.lastIndexOf('/') + 1));

        function UserLink(u) {
            if (!config.users[u])
            {
                if (typeof (config.users[u] == 'string'))
                    return '<@' + config.users[u] + '>';
                if (!target && !config.users[u][target])
                    return '<@' + config.users[u][target] + '>';
            }
            return 'OP_USER_' + u;
        }

        let fields = [];
        let notify = '';
        if (cache[b.id] == null) cache[b.id] = {};
        if (cache[b.id] != null && cache[b.id].status != st)
        {
            console.log('Status update from ' + cache[b.id].status_title + ' to ' + status);
            fields.push( { name : 'Status', value : cache[b.id].status_title + ' -> ' + status });
            cache[b.id].status = st;
            cache[b.id].status_title = status;
        }
        if (cache[b.id] != null && cache[b.id].assignee != ass)
        {
            console.log('Assignee update from ' + (cache[b.id].assignee_title??'none') + ' to ' + assignee);
            fields.push( { name : 'Assignee', value : (cache[b.id].assignee_title??'none') + ' -> ' + assignee });
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
            let message = { username :  'OP Bot', color: HEXToVBColor(b._embedded?.status?.color) }; // title = ''
            message.fields = fields;
            let header = '**Обновление задачи №' + b.id + '**';
            if (st == config.op_status_need_testing)
            {
                header = '**Задача №' + b.id + ' готова к тестированию**';

                try
                {
                    let resp = await axios.get(config.op_host + '/api/v3/work_packages/' + b.id + '/activities', { auth : config.op_auth });
                    let list = resp.data?._embedded?.elements;
                    let hasRequest = false;
                    if (list != null && config.git_host != null)
                    {
                        for (let el of list)
                        {
                            if (el._type == 'Activity::Comment' && el.comment != null)
                            {
                                if (el.comment.raw.indexOf(config.git_host) >= 0)
                                    hasRequest = true;
                            }
                        }
                    }
                
                    if (!hasRequest)
                        header += ' !!! Отсутствует реквест !!!';
                }
                catch (exc)
                {
                    console.error('Cannot fetch comments of ' + b.id + ': ' + exc);
                }

                if (project.testers != null)
                    for (let id of project.testers)
                        notify += UserLink(id);
            }
            if (st == config.op_status_need_review)
            {
                header = '**Задача №' + b.id + ' готова к ревью**';
                if (project.reviewers != null)    
                    for (let id of project.reviewers)
                        notify += UserLink(id);
            }
            if (st == config.op_status_need_prereview)
            {
                header = '**Задача №' + b.id + ' требует преревью**';
                if (project.prereviewers != null)
                    for (let id of project.prereviewers)
                        notify += UserLink(id);
            }
            let link = config.op_host + '/work_packages/' + b.id + '/activity'
            let content = {};
            if (target == 'telegram')
                content.parse_mode = 'html';
            let str = header + '\n' + b.subject + '\n' + link + ' ' + notify;
            if (project.chat_id)
            {
                content.chat_id = project.chat_id;
                content.text = str;
                if (project.topic)
                    content.reply_to_message_id = project.topic
            }
            else
            {
                content.content = str;
                content.embeds = [ message ];
            }
            await axios.post(project.webhook, content);
        }

        res.status(200).send('ok');
    });

    if (config.admin_key != null)
    {
        app.server.get('/ophook_admin_' + config.admin_key, async (req, res) => 
        {
            
        });
    }
}
import axios from 'axios';

export async function getTasks(config, proj_id, filter)
{
    try {
        const res = await axios.get(config.op_host + '/api/v3/projects/' + proj_id + '/work_packages?' + (filter ? 'filters=' + JSON.stringify(filter) + '&': '') + 'pageSize=500', { auth: config.op_auth });
        const list = res.data._embedded?.elements;
        return list;
    }
    catch (exc) {
        console.error(exc);
        return {
            error: exc.message
        }
    }
}

export async function getStatuses(config)
{
    try {
        const opStatuses = await axios.get(config.op_host + '/api/v3/statuses');
        const list = opStatuses.data?._embedded?.elements;
        return list;
    }
    catch (exc) {
        console.error(exc);
        return {
            error: exc.message
        }
    }
}

export async function getComments(config, context) {
    try {
        const resp = await axios.get(config.op_host + '/api/v3/work_packages/' + context.task_id + '/activities', { auth: config.op_auth });
        let list = resp.data?._embedded?.elements;
        if (Array.isArray(list)) {
            return list.filter(el => el._type == 'Activity::Comment' && el.comment?.raw).map(el => el.comment.raw);
        }
    } catch (exc)
    {
        console.error(exc);
    }
    return { error: exc.message }
}

export default { getTasks, getStatuses, getComments }
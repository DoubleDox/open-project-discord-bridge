import axios from 'axios';
import fs from 'fs';
import path from 'path';
import op from '../api/open-project.js';
const regex = /(https?:\/\/[^\s]+)\/([^\/]+)/im;
export default async function doAction(config, context)
{
    const project = context.project;
    const task_id = context.task_id;
    if (!task_id)
        return { error: 'Task id not specified in context' };
    if (!project)
        return { error : 'Project not specified in context'}
    if (config.git_host) {
        try {
            let comments = await op.getComments(config, context);
            if (Array.isArray(comments)) {
                const mergeRequest = comments.find(c => c.indexOf(config.git_host) >= 0)?.trim();
                if (!mergeRequest)
                    return { message: config.actions?.check_request_attached?.message ?? ' ⚠️ No request specified ⚠️' };
                else {
                    const match = mergeRequest.match(regex);
                    const request_id = match[2];
                    console.log('requesting contents of mr ' + request_id);
                    const resp = await axios.get(config.git_host + '/api/v4/projects/' + project.git_id + '/merge_requests/' + request_id + '/changes', { headers: { 'PRIVATE-TOKEN': 'xzVt4EP_4quzfwUjgW_Q' } });
                    //resp.data.diff_refs.head_sha - last commit in branch
                    //resp.data.diff_refs.base_sha   |
                    //resp.data.diff_refs.start_sha  |- base commit in develop to compared with?
                    //resp.data.changes = []
                    //-- old_path, new_path
                    if (resp.data.changes) {
                        const result = await validateFiles(resp.data.changes.map(m => m.new_path));
                        if (!result) {
                            console.error('There are problems in mr ' + request_id);
                        }
                        else
                            console.log('mr ' + request_id + ' is ok');
                    }
                    return {};
                }
            }
            else if (comments.error)
                console.error(comments.error);
        }
        catch (exc) {
            return { error: 'Cannot fetch comments of ' + task_id + ': ' + exc.message };
        }
    }
    else
        return { error: 'No git setup' };
}

let filter = null;
let picomatch = null;

const validateFiles = async (files) => {
    let hasErrors = false;

    if (!filter)
    {
        filter = fs.existsSync('./unity-rules.json') ? JSON.parse(fs.readFileSync('./unity-rules.json', 'utf8')) : [];
    }

    for (const file of files) {
        const posixFile = file.split(path.sep).join(path.posix.sep); 
        let isMatchAny = false;
        for (const rule of filter.rules) {
            if (picomatch == null)
                picomatch = (await import('picomatch')).default;
            const isMatch = rule.pattern && picomatch(rule.pattern)(posixFile);

            if (isMatch) {
                isMatchAny = true;
                // Если есть allowedIn, проверяем вхождение в любую из разрешенных папок
                if (rule.allowedIn && rule.allowedIn.length > 0) {
                    const isInAllowedDir = rule.allowedIn.some(allowedDir =>
                        posixFile.startsWith(allowedDir)
                    );

                    if (!isInAllowedDir) {
                        console.error(`[${rule.severity.toUpperCase()}]: Файл "${file}" нарушает правило: ${rule.description}`);
                        console.error(`  -> Должен находиться в одной из папок: ${rule.allowedIn.join(', ')}`);
                        hasErrors = true;
                    }
                }
            } else if (rule.pattern && picomatch(rule.pattern)(posixFile)) {
                isMatchAny = true;
                // Обработка старых правил "запрещено здесь" (если они еще нужны)
                if (rule.allowed === false) {
                    console.error(`[${rule.severity.toUpperCase()}]: Файл "${file}" нарушает правило: ${rule.description}`);
                    hasErrors = true;
                }
            }
        }
        if (!isMatchAny)
            console.log('File ' + file + ' not matched any pattern');
    }

    return !hasErrors;
};
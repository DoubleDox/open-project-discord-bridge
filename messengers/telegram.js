const target = 'telegram';

export function markup(message)
{
    return message;
}

export function prepareMessage(project, str)
{
    const content = {};
    content.parse_mode = 'html';
    if (project.chat_id) {
        content.chat_id = project.chat_id;
        content.text = str;
        if (project.topic)
            content.reply_to_message_id = project.topic
    }
    else
        console.error('project.chat_id should be setup for ' + target);
    return content;
}

export function userLink(user)
{
    return '@' + (user[target] ?? user);
}
const target = 'discord';

export function markup(message)
{
    return message.replace('<b>', '**').replace('</b>', '**');
}

export function userLink(user)
{
    return '<@' + (user[target] ?? user) +  '>';
}
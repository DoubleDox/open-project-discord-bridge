const target = 'discord';

export function markup(message)
{
    return message.replace('<b>', '**').replace('</b>', '**');
}

export function prepareMessage(str)
{
    const message = { username: 'OP Bot', color: HEXToVBColor(b._embedded?.status?.color) };
    message.fields = fields;
}

export function userLink(user)
{
    return '<@' + (user[target] ?? user) +  '>';
}


function HEXToVBColor(rrggbb, start) {
    let st = start ?? 0;
    var bbggrr = rrggbb.substr(4 + st, 2) + rrggbb.substr(2 + st, 2) + rrggbb.substr(st, 2);
    return parseInt(bbggrr, 16);
}

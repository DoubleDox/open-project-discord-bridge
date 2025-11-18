# Open Project Hook for messengers
Webhook Bridge from OpenProject to messengers
Currently supported: 
1. Discord
2. Telegram
   
Getting started:
1. Obtain webhook url in messenger (**webhook** field in config)
   * for Discord - generate channel webhook
   * for Telegram - create bot and provide send message URL with bot's token
3. Generate api key to access Open Project (**op_auth** field in config)
4. place config.json to script folder with example content:
```json
{
    "port" : 8080,
    "op_host": "https://YOUR_OPENPROJECT_HOST",
    "op_auth": {
        "username": "key",
        "password": "password"
    },
    "op_status_closed": "OPEN_PROJECT_CLOSED_STATUS_ID",
    "op_status_need_testing": "OPEN_PROJECT_NEED_TESTING_STATUS_ID",
    "op_status_need_review": "OPEN_PROJECT_NEED_REVIEW_STATUS_ID",
    "users":
    {
        "USER_OP_ID":"USER_DISCORD_ID"
    },
    "projects" :
    [
        {
            "name":"PROJECT_NAME",
            "op_id": "PROJECT_ID_IN_OP",
            "webhook":"https://discord.com/api/webhooks/YOUR_MESSENGER_WEBHOOK"
        }
    ]
}
```
4. launch with NodeJS script app.js. If OP auth setup is corect, script should load list of the current opened work packages.
5. Setup webhook in Open Project for work package "create" and "update" events, leading to http(s)://YOUR_OPDISCORDBRIDGE:port/ophook

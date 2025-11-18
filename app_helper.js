import fs from 'fs';
import bodyParser from 'body-parser';
import express from 'express';

export class App 
{
    constructor(config)
    {
        this.server = express();
        
        this.server.use(bodyParser.urlencoded({ extended: false }));
        this.server.use(bodyParser.json());
        this.config = config;
        
        this.server.get('/version', async (req, res) =>
        {
            res.setHeader("content-type", "text/html");
            res.send(this.version);
        });

        this.version = JSON.parse(fs.readFileSync(process.cwd() + '/package.json', 'utf8')).version;

        this.LazyInit();
    }

    async LazyInit()
    {
        let cors = this.config.cors ? await import('cors') : null;
        if (cors != null)
            this.server.use(cors({ origin: '*' }));
    }

    AuthRequired(res)
    {
        res.status(403).send("{ statusCode : -1, errorMessage : 'AuthRequired'}");
    }

    Start()
    {
        let port = this.config.port ?? 8080;
        this.server.listen(port, () => 
        {
            console.log(this.config.name + ` service listening on port ${port}`)
        });        
    }
}

export default App;
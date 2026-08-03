import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:3000';
const backendHost = backendUrl.replace(/^https?:\/\//, '').split(':')[0];
const backendPort = parseInt(backendUrl.split(':')[2] || '3000', 10);

app.use('/api', (req: express.Request, res: express.Response) => {
  const options = {
    hostname: backendHost,
    port: backendPort,
    path: req.url ? `/api${req.url}` : '/api',
    method: req.method,
    headers: { ...req.headers, host: `${backendHost}:${backendPort}` },
  };

  const proxy = httpRequest(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Backend unavailable' });
  });

  req.pipe(proxy, { end: true });
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error?: Error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);

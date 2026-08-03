
export default {
  basePath: '/',
  allowedHosts: [
  "localhost",
  "localhost:4000",
  "localhost:4200",
  "localhost:4201",
  "localhost:4202",
  "localhost:4203",
  "127.0.0.1"
],
  supportedLocales: {
  "en-US": ""
},
  entryPoints: {
    '': () => import('./main.server.mjs')
  },
};

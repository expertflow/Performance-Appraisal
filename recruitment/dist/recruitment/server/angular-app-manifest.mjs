
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-DjsJtlPA.js"
    ],
    "route": "/dashboard"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-yXg1qsYO.js"
    ],
    "route": "/requisitions"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-CnmdHV0p.js"
    ],
    "route": "/pipeline"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-BdacsvJf.js"
    ],
    "route": "/offer"
  },
  {
    "renderMode": 2,
    "redirectTo": "/",
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 10319, hash: '5f10ad4efc0c83496c139a160f3675a65ab82c63296aa9effd282012cd42938f', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 9814, hash: 'e6d9487065adafcedca0d77299a69f0f812c74b4f925a3678874c85723773692', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 252, hash: '70fded1a23c1727b8dbdfae3b840cf7bca033e0a34323a24cbab74440942707a', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'dashboard/index.html': {size: 31525, hash: 'f8908042c873e00602f5f60e6308610cf978d797da0589eca2974b17b9609a08', text: () => import('./assets-chunks/dashboard_index_html.mjs').then(m => m.default)},
    'offer/index.html': {size: 32336, hash: 'cba2f3ff66942d932aee7c22f8e04e34ae5abb54e260cad7fd102640ddb58b08', text: () => import('./assets-chunks/offer_index_html.mjs').then(m => m.default)},
    'requisitions/index.html': {size: 34190, hash: '834ffa3227653e462f91b3be66eec57b3ba8aaf01dc8a944685577697a1feb68', text: () => import('./assets-chunks/requisitions_index_html.mjs').then(m => m.default)},
    'pipeline/index.html': {size: 39902, hash: 'c6ee55fc9cc2d58accc64e91fa58782b22f82b19686f98410f39765832ce6beb', text: () => import('./assets-chunks/pipeline_index_html.mjs').then(m => m.default)},
    'styles-IVCN3QHO.css': {size: 6374, hash: 'Ec6faIvjunQ', text: () => import('./assets-chunks/styles-IVCN3QHO_css.mjs').then(m => m.default)}
  },
};


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
      "chunk-DaypDpU-.js"
    ],
    "route": "/dashboard"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-CDQ-t84J.js"
    ],
    "route": "/cycles"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-DG3t2ghX.js"
    ],
    "route": "/goals"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-zc5HqluK.js"
    ],
    "route": "/feedback"
  },
  {
    "renderMode": 2,
    "redirectTo": "/",
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 10317, hash: 'ae8a584b89afebf00204a76dd2969a9df0788b672c7cf635956f07eeef559725', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 9812, hash: '5c70050521c43a27b7f6e13bfc92f6ae486252f534b7a664f9e736fc9e71a3eb', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 252, hash: '70fded1a23c1727b8dbdfae3b840cf7bca033e0a34323a24cbab74440942707a', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'cycles/index.html': {size: 30129, hash: 'a05053376f1b7e6ade4f7ad25dd4b9fc1a381e3dd0443dd6e9cd8ca96f2b5953', text: () => import('./assets-chunks/cycles_index_html.mjs').then(m => m.default)},
    'goals/index.html': {size: 34602, hash: '846d81d62842cf0aa53920bdc12ac3c5c746bf762495ef760143198f044684f1', text: () => import('./assets-chunks/goals_index_html.mjs').then(m => m.default)},
    'dashboard/index.html': {size: 34469, hash: '64207829f5ffdeb760af7bfa5b365e2fae1d1361e84135191683ae4a7e1bc26f', text: () => import('./assets-chunks/dashboard_index_html.mjs').then(m => m.default)},
    'feedback/index.html': {size: 33526, hash: '6ee778536790e10860d9826f7bdbbf2346c8673e1fc31fea24dc2317efda3f6e', text: () => import('./assets-chunks/feedback_index_html.mjs').then(m => m.default)},
    'styles-CD2SCXXL.css': {size: 5061, hash: '9LNV5ag4zHc', text: () => import('./assets-chunks/styles-CD2SCXXL_css.mjs').then(m => m.default)}
  },
};

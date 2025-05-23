# test

* client

```sh
curl -X POST http://localhost:4321/api/submit --data '{  "username": "test",  "password": "password"}'
{"success":true}
```

* server

```sh
bun dev
$ astro dev
22:32:44 [types] Generated 7ms
22:32:44 [content] Syncing content
22:32:44 [content] Synced content

 astro  v5.8.0 ready in 1062 ms

┃ Local    http://localhost:4321/
┃ Network  use --host to expose

22:32:44 watching for file changes...
Request {
  method: 'POST',
  url: 'http://localhost:4321/api/submit',
# test
  headers: Headers {
    host: 'localhost:4321',
    'user-agent': 'curl/8.1.2',
    accept: '*/*',
    'content-length': '47',
    'content-type': 'application/x-www-form-urlencoded'
  },
  destination: '',
  referrer: 'about:client',
  referrerPolicy: '',
  mode: 'cors',
  credentials: 'same-origin',
  cache: 'default',
  redirect: 'follow',
  integrity: '',
  keepalive: false,
  isReloadNavigation: false,
  isHistoryNavigation: false,
  signal: AbortSignal { aborted: false }
}
Received: { username: 'test', password: 'password' }
22:32:46 [200] POST /api/submit 25ms
```


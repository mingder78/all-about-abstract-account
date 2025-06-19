# 🔐 WebAuthn Wallet Tester – Fullstack Project

This project demonstrates a secure Passkey-based authentication system using **WebAuthn**, powered by:

- ⚡️ Astro (Frontend)
- ⚙️ Bun (Server runtime)
- 📦 Xata (Database)
- 🧠 WebAuthn (Passwordless authentication)
- 🧪 cURL for testing

---

## 📁 Project Structure

```

.
├── frontend/          # Astro frontend (src/, public/, layouts, styles)
├── backend/           # API handlers and database clients (xata.ts)
└── contracts/         # Smart contracts using Foundry (optional)

```

---

## 🚀 Getting Started

### 1. Start the Development Server

```bash
bun dev
# This runs the Astro server on http://localhost:4321
```

---

## 🧪 API Testing (Manual)

### Endpoint: `/api/submit`

You can test the API using `curl` like this:

```bash
curl -X POST http://localhost:4321/api/submit \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data 'username=test&password=password'
```

### ✅ Expected Response

```json
{ "success": true }
```

---

## 📦 Server Console Logs Example

```bash
 astro  v5.8.0 ready in 1062 ms

┃ Local    http://localhost:4321/
┃ Network  use --host to expose

[200] POST /api/submit 25ms
Received: { username: 'test', password: 'password' }
```

---

## 🔍 Request Sample

```http
POST /api/submit HTTP/1.1
Host: localhost:4321
User-Agent: curl/8.1.2
Accept: */*
Content-Type: application/x-www-form-urlencoded
Content-Length: 47

username=test&password=password
```

---

## 🛠 Tech Stack

- **Astro** – for frontend rendering
- **Bun** – super-fast dev server + runtime
- **Xata** – modern serverless DB
- **WebAuthn** – passwordless login with Passkeys
- **Foundry** – Solidity smart contract tooling (optional)

```

---

```

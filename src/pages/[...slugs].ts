import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { getXataClient, type DatabaseSchema } from "../xata";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifyRegistrationResponseOpts,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import base64url from 'base64url';

const xata = getXataClient();

const RP_NAME = import.meta.env.RP_NAME || 'YourApp';
const RP_ID = import.meta.env.RP_ID || 'localhost';
const ORIGIN = import.meta.env.ORIGIN || 'http://localhost:4321';

// Types for our data models
const UserSchema = t.Object({
  id: t.Optional(t.Number()),
  username: t.String(),
  password: t.String()
});

const ItemSchema = t.Object({
  id: t.Optional(t.Number()),
  name: t.String(),
  description: t.Optional(t.String()),
  user_id: t.Optional(t.Number()),
  created_at: t.Optional(t.String())
});

const LoginSchema = t.Object({
  username: t.String(),
  password: t.String()
});

const EmailSchema = t.Object({ email: t.String({ format: 'email' }) });

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Fix padding and URL-safe encoding if needed
  base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}


function safeBase64Decode(base64String: string) {
  try {
    // Add padding if missing
    while (base64String.length % 4 !== 0) {
      base64String += '=';
    }

    // Replace URL-safe Base64 characters (if needed)
    base64String = base64String.replace(/-/g, '+').replace(/_/g, '/');

    return atob(base64String);
  } catch (err) {
    console.error("Base64 decode error:", err.message);
    return null;
  }
}


const app = new Elysia()
  .use(swagger())
  .use(cors())
  .use(jwt({
    name: 'jwt',
    secret: import.meta.env.JWT_SECRET!
  }))
  .group("status", (app) =>
    app.get("/ping", () => "Hello ming, Vercel with Bun!")
  )
  .post(
    '/register/options',
    async ({ body: { email } }) => {
      const user = await xata.db.users.createOrUpdate({ email, userHandle: crypto.randomUUID() });
      const credentials = await xata.db.credentials.filter({ userId: user.id }).getMany();
      const challenge = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: isoUint8Array.fromUTF8String('customUserIDHere'), //user.userHandle,
        userName: email,
        attestationType: 'none',
        excludeCredentials: credentials.map((cred) => ({
          id: base64url.decode(cred.credentialID || ""),
          type: 'public-key',
          transports: cred.transports || [],
        })),
      });
      // Store challenge temporarily (e.g., in Xata or in-memory)
      await xata.db.users.update(user.id, { challenge: challenge.challenge });

      return challenge;
    },
    { body: EmailSchema }
  )
  // Registration: Verify response
  .post(
    '/register/verify',
    async ({ body: { email, response }, jwt}) => {
      console.log(response)
        const clientDataJSON = Buffer.from(response.response.clientDataJSON, 'base64').toString('utf-8');
        console.log(clientDataJSON)
      const clientData = JSON.parse(clientDataJSON); 
      console.log(clientData)
      const user = await xata.db.users.filter({ email }).getFirst();
      if (!user || !user.challenge) {
        throw new Error('User or challenge not found');
      }
      console.log(user.challenge)
      let verification: VerifiedRegistrationResponse;
      try {
        const opts: VerifyRegistrationResponseOpts = {
          response,
          expectedChallenge: user.challenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          requireUserVerification: false,
        };
        verification = await verifyRegistrationResponse(opts);
        console.log(verification)
        console.log('verification.verified')
      } catch (error) {
        const _error = error as Error;
        console.error(_error);
        return new Response(null, {
          status: 505,
          statusText: _error.message
        });
      }
      if (verification.verified) {
        await xata.db.credentials.create({
          credentialID: base64url.encode(verification.registrationInfo!.credential!.id),
          publicKey: verification.registrationInfo!.credential!.publicKey.toString(),
          counter: verification.registrationInfo!.credential!.counter,
          userId: user.id,
          transports: response.transports || [],
        });

        // Clear challenge
        await xata.db.users.update(user.id, { challenge: null });

        // Generate JWT
        const token = await jwt.sign({ userId: user.id, email });
        console.log(token)
        return { verified: true, token };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        response: t.Any(), // WebAuthn response is complex; use Any for simplicity
      }),
    }
  )
  // Authentication: Generate options
  .post(
    '/login/options',
    async ({ body: { email } }) => {
      const user = await xata.db.users.filter({ email }).getFirst();
      if (!user) {
        throw new Error('User not found');
      }

      const credentials = await xata.db.credentials.filter({ userId: user.id }).getMany();
      console.log(credentials)
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: credentials.map((cred) => ({
          id: base64url.decode(cred.credentialID),
          type: 'public-key',
          transports: cred.transports || [],
        })),
      });
console.log(options)
      // Store challenge
      await xata.db.users.update(user.id, { challenge: options.challenge });

      return options;
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) }
  )
  // Authentication: Verify response
  .post(
    '/login/verify',
    async ({ body: { email, response }, jwt }) => {
      const user = await xata.db.users.filter({ email }).getFirst();
      if (!user || !user.challenge) {
        throw new Error('User or challenge not found');
      }
      console.log(response)

      // Ensure rawId is a Buffer
      const rawIdBuffer = Buffer.from(response.rawId, response.rawId instanceof ArrayBuffer ? 'base64' : undefined);
      const credential = await xata.db.credentials
        .filter({ credentialID: base64url.encode(rawIdBuffer) })
        .getFirst();
console.log(credential)
console.log('ming')
      if (!credential) {
        throw new Error('Credential not found');
      }

      const credentialFromDB: WebAuthnCredential = {
  id: Buffer.from(credential.credentialID, 'base64url'),
  publicKey: Buffer.from(credential.publicKey, 'base64url'),
  counter: credential.counter,
  transports: credential.transports, // optional
};

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: user.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: credentialFromDB,
      });
      console.log(verification)

      if (verification.verified) {
        await xata.db.credentials.update(credential.id, {
          counter: verification.authenticationInfo.newCounter,
        });

        await xata.db.users.update(user.id, { challenge: null });
        const token = await jwt.sign({ userId: user.id, email });
        return { verified: true, token };
      }

      throw new Error('Authentication failed');
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        response: t.Any(),
      }),
    }
  )

export type App = typeof app;

const handle = ({ request }: { request: Request }) => app.handle(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;

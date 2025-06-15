import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from '@elysiajs/cors';
import { getXataClient, type DatabaseSchema } from "../xata";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import base64url from 'base64url';

const xata = getXataClient();

const RP_NAME = import.meta.env.RP_NAME || 'app';
const RP_ID = import.meta.env.RP_ID || 'localhost';
const ORIGIN = import.meta.env.ORIGIN || 'http://localhost:3000';

console.log(RP_NAME)

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

const app = new Elysia()
  .use(swagger())
  .use(cors())
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
    async ({ body: { email, response } }) => {
      console.log(response)
      const user = await xata.db.users.filter({ email }).getFirst();
      if (!user || !user.challenge) {
        throw new Error('User or challenge not found');
      }
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
        console.log(verification.verified)
        console.log('verification.verified')
      } catch (error) {
        const _error = error as Error;
        console.error(_error);
        return { error: _error.message };
      }
      if (verification.verified) {
        await xata.db.credentials.create({
          credentialID: base64url.encode(verification.registrationInfo!.credentialID),
          publicKey: verification.registrationInfo!.credentialPublicKey.toString('base64'),
          counter: verification.registrationInfo!.counter,
          userId: user.id,
          transports: response.transports || [],
        });

        // Clear challenge
        await xata.db.users.update(user.id, { challenge: null });

        // Generate JWT
        const token = await app.jwt.sign({ userId: user.id, email });
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
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: credentials.map((cred) => ({
          id: base64url.decode(cred.credentialID),
          type: 'public-key',
          transports: cred.transports || [],
        })),
      });

      // Store challenge
      await xata.db.users.update(user.id, { challenge: options.challenge });

      return options;
    },
    { body: t.Object({ email: t.String({ format: 'email' }) }) }
  )
  // Authentication: Verify response
  .post(
    '/login/verify',
    async ({ body: { email, response } }) => {
      const user = await xata.db.users.filter({ email }).getFirst();
      if (!user || !user.challenge) {
        throw new Error('User or challenge not found');
      }

      // Ensure rawId is a Buffer
      const rawIdBuffer = Buffer.from(response.rawId, response.rawId instanceof ArrayBuffer ? 'base64' : undefined);
      const credential = await xata.db.credentials
        .filter({ credentialID: base64url.encode(rawIdBuffer) })
        .getFirst();

      if (!credential) {
        throw new Error('Credential not found');
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: user.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        authenticator: {
          credentialID: base64url.decode(credential.credentialID),
          credentialPublicKey: Buffer.from(credential.publicKey, 'base64'),
          counter: credential.counter,
        },
      });

      if (verification.verified) {
        await xata.db.credentials.update(credential.id, {
          counter: verification.authenticationInfo.newCounter,
        });

        await xata.db.users.update(user.id, { challenge: null });
        const token = await app.jwt.sign({ userId: user.id, email });
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

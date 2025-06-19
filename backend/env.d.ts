interface ImportMetaEnv {
    ORIGIN: string;
    RP_ID: string;
    RP_NAME: string;
    JWT_SECRET: string | Uint8Array<ArrayBufferLike> | KeyLike;
    readonly XATA_API_KEY: string;
    readonly XATA_BRANCH?: string;
    readonly XATA_DATABASE_URL?: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
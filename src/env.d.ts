interface ImportMetaEnv {
  /** Token z Google Search Console (metoda „HTML tag“). Prázdné = tag se nevypíše. */
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

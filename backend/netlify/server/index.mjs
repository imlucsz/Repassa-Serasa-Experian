// Netlify Server entry (PoC): boots the compiled NestJS/Fastify app as-is.
//
// Netlify assigns PORT; backend env validation reads it. The app then
// listens like any Node server — no adapter or wrapper needed per
// https://docs.netlify.com/build/server/get-started/ ("your framework starts
// its own server").
//
// `path` restricts the server to API traffic; everything else (if this site
// ever serves static files) falls through to the rest of the project.

export const config = {
  path: ['/api/v1/*', '/api/docs', '/api/docs/*'],
  region: 'cmh',
  size: 'small',
};

// ../../dist/main.js is produced by `npm run build` (nest build -> dist/).
// Importing it runs bootstrap(): NestFactory.create + configureApp + listen.
await import('../../dist/main.js');

// Production entry point for `npm start` (`node server.ts`)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

await import('./server/index.ts');

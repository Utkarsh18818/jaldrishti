import { validateRuntimeSecrets } from './aws-runtime.mjs';
try {
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) throw new Error('Lambda runtime required.');
  validateRuntimeSecrets();
  process.env.HOSTNAME = '0.0.0.0';
  process.env.PORT = '8080';
  await import('./server.js');
} catch {
  // Deliberately discard provider exception details: they may contain secret values.
  console.error('Frontend runtime initialization failed.');
  process.exitCode = 1;
}

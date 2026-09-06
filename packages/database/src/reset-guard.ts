export function assertResetAllowed(env: string = process.env.NODE_ENV || 'development') {
  if (env === 'production' && process.env.ALLOW_PRODUCTION_RESET !== 'true') {
    throw new Error(
      'CRITICAL SAFETY ERROR: Database reset is strictly prohibited in production! Set ALLOW_PRODUCTION_RESET=true to explicitly override if required.'
    );
  }
}

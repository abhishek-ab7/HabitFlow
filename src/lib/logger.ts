/**
 * Custom logger that suppresses outputs in production environment.
 */
const IS_DEV = process.env.NODE_ENV === 'development';

export const logger = {
  info: (message: string, ...details: any[]) => {
    if (IS_DEV) {
      console.log(message, ...details);
    }
  },
  warn: (message: string, ...details: any[]) => {
    if (IS_DEV) {
      console.warn(message, ...details);
    }
  },
  error: (message: string, ...details: any[]) => {
    // In production we still want to log errors, but maybe differently. Let's log them always.
    console.error(message, ...details);
  }
};

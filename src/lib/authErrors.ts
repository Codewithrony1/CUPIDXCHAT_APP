/**
 * CupidX Authentication Error Translator
 * Maps Clerk authentication error codes to user-friendly messages.
 */

export function getFriendlyAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  // If Clerk error array is present
  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    const firstError = error.errors[0];
    if (firstError?.longMessage) return firstError.longMessage;
    if (firstError?.message) return firstError.message;
    if (firstError?.code) {
      const mapped = mapClerkErrorCode(firstError.code);
      if (mapped) return mapped;
    }
  }

  const code = typeof error === 'string' ? error : error?.code || error?.message || '';
  const mapped = mapClerkErrorCode(code);
  if (mapped) return mapped;

  if (typeof error?.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return 'Authentication failed. Please try again.';
}

function mapClerkErrorCode(code: string): string {
  switch (code) {
    // Identifier & Account Errors
    case 'form_identifier_not_found':
      return 'No account was found with this email or username. Please check your spelling or sign up.';
    case 'form_password_incorrect':
      return 'Incorrect password. Please try again or reset your password.';
    case 'form_identifier_exists':
      return 'An account already exists with this email address. Please sign in instead.';
    case 'form_password_length_too_short':
      return 'Please choose a stronger password (minimum 8 characters).';
    case 'form_password_pwned':
      return 'This password has appeared in a data breach. Please choose a more secure password.';
    case 'form_code_incorrect':
      return 'The verification code you entered is incorrect. Please check and try again.';
    case 'verification_expired':
      return 'The verification code has expired. Please request a new code.';
    case 'session_exists':
      return 'You are already signed in. Redirecting to your dashboard...';
    case 'user_locked':
      return 'Account temporarily locked due to too many failed attempts. Please try again later.';
    case 'strategy_for_user_invalid':
      return 'This sign-in method is not enabled for your account.';
    case 'too_many_requests':
      return 'Too many attempts. Please wait a few moments and try again.';
    case 'network_error':
      return 'Network connection error. Please check your internet and try again.';
    default:
      return '';
  }
}

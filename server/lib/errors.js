export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message, details) =>
    new AppError(400, "BAD_REQUEST", message, details),
  unauthorized: (message = "Authentication is required.") =>
    new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You do not have permission to perform this action.") =>
    new AppError(403, "FORBIDDEN", message),
  notFound: (message = "The requested resource was not found.") =>
    new AppError(404, "NOT_FOUND", message),
  conflict: (message, details) =>
    new AppError(409, "CONFLICT", message, details),
  dependencyUnavailable: (
    message = "A required service is temporarily unavailable.",
  ) => new AppError(503, "DEPENDENCY_UNAVAILABLE", message),
};

export function normalizeDatabaseError(error) {
  if (error?.code === "23P01") {
    return errors.conflict(
      "The requested time overlaps an existing appointment.",
    );
  }
  if (error?.code === "23505") {
    return errors.conflict(
      "A record with the same unique value already exists.",
    );
  }
  if (["22001", "22P02", "23503", "23514"].includes(error?.code)) {
    return errors.badRequest(
      "The request contains a value the database cannot accept.",
    );
  }
  return null;
}

export function errorEnvelope(error, requestId) {
  return {
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error.message || "An unexpected error occurred.",
      ...(error.details ? { details: error.details } : {}),
      requestId,
    },
  };
}

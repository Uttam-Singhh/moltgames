import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(
  statusCode: number,
  message: string,
  code?: string
) {
  return NextResponse.json(
    { error: { message, code: code ?? "ERROR" } },
    { status: statusCode }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return errorResponse(error.statusCode, error.message, error.code);
  }
  console.error("Unhandled error:", error);
  return errorResponse(500, "Internal server error", "INTERNAL_ERROR");
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new AppError(code, message, 400);
  }

  static unauthorized(message = 'Не авторизован', code = 'UNAUTHORIZED') {
    return new AppError(code, message, 401);
  }

  static forbidden(message = 'Доступ запрещён', code = 'FORBIDDEN') {
    return new AppError(code, message, 403);
  }

  static notFound(message = 'Не найдено', code = 'NOT_FOUND') {
    return new AppError(code, message, 404);
  }

  static internal(message = 'Внутренняя ошибка сервера', code = 'INTERNAL_ERROR') {
    return new AppError(code, message, 500);
  }
}

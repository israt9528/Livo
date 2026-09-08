// export class AppError extends Error {
//   public statusCode: number;

//   constructor(statusCode: number, message: string, stack = "") {
//     super(message); // throw new Error(message)

//     this.statusCode = statusCode;

//     if (stack) {
//       this.stack = stack;
//     } else {
//       Error.captureStackTrace(this, this.constructor);
//     }
//   }
// }

export class AppError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message: string, stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";

    // Restores prototype chain across tsup / esbuild bundling
    Object.setPrototypeOf(this, new.target.prototype);

    if (stack) {
      this.stack = stack;
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

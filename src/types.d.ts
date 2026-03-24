// 扩展 Express 的 Request 类型，添加 userId 和 adminId 字段
import 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      adminId?: string;
      adminRole?: string;
    }
  }
}

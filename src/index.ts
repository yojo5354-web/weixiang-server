import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import userRouter from './modules/user/routes';
import contentRouter from './modules/content/routes';
import socialRouter from './modules/social/routes';
import aiRouter from './modules/ai/routes';
import adminRouter from './modules/admin/routes';

const app = express();
const prisma = new PrismaClient();

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 挂载 Prisma 到全局
declare global {
  // eslint-disable-next-line no-var
  var prisma: import('@prisma/client').PrismaClient | undefined;
}
global.prisma = prisma;

// 路由
app.use('/api/user', userRouter);
app.use('/api/content', contentRouter);
app.use('/api/social', socialRouter);
app.use('/api/ai', aiRouter);
app.use('/api/admin', adminRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    code: err.code || 'ERROR',
    message: err.message || '服务器错误'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 味享 API 服务已启动: http://localhost:${PORT}`);
  console.log(`📚 API 文档: http://localhost:${PORT}/api/health`);
});

export default app;

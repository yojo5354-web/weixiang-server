import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../content/client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'weixiang-secret-key-2024';
const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || 'weixiang-admin-secret-2024';

// ==================== 管理员认证中间件 ====================
const adminAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  }
  try {
    const decoded: any = jwt.verify(token, ADMIN_SECRET);
    req.adminId = decoded.adminId;
    req.adminRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token无效' });
  }
};

// ==================== 管理员登录 ====================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    // 演示模式：固定账号密码
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign(
        { adminId: 'admin-001', role: 'super', username: 'admin' },
        ADMIN_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        code: 'SUCCESS',
        message: '登录成功',
        data: {
          token,
          admin: { id: 'admin-001', username: 'admin', role: 'super', nickname: '超级管理员' }
        }
      });
    }
    res.status(401).json({ code: 'AUTH_FAILED', message: '用户名或密码错误' });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取管理员信息
router.get('/info', adminAuth, async (req: any, res) => {
  res.json({
    code: 'SUCCESS',
    data: { id: req.adminId, username: 'admin', role: req.adminRole, nickname: '超级管理员' }
  });
});

// ==================== 统计数据 ====================
router.get('/stats/dashboard', adminAuth, async (req, res) => {
  try {
    const [userCount, contentCount, orderCount] = await Promise.all([
      prisma.user.count({ where: { status: 1 } }),
      prisma.content.count({ where: { status: 1 } }),
      prisma.order.count()
    ]);

    // 今日新增用户（近7天每天数据）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true }
    });
    const recentContents = await prisma.content.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, status: 1 },
      select: { createdAt: true }
    });

    // 生成近7天数据
    const days: string[] = [];
    const userTrend: number[] = [];
    const contentTrend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dayStr = `${day.getMonth() + 1}/${day.getDate()}`;
      days.push(dayStr);
      const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
      userTrend.push(recentUsers.filter(u => u.createdAt >= dayStart && u.createdAt <= dayEnd).length);
      contentTrend.push(recentContents.filter(c => c.createdAt >= dayStart && c.createdAt <= dayEnd).length);
    }

    // 待审核内容数
    const pendingCount = await prisma.content.count({ where: { status: 0 } });

    res.json({
      code: 'SUCCESS',
      data: {
        overview: {
          totalUsers: userCount,
          totalContents: contentCount,
          totalOrders: orderCount,
          pendingAudit: pendingCount,
          todayNewUsers: userTrend[6],
          todayNewContents: contentTrend[6]
        },
        trend: { days, users: userTrend, contents: contentTrend }
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// ==================== 内容管理 ====================
router.get('/content/list', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, keyword } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status !== undefined && status !== '') where.status = Number(status);
    if (keyword) {
      where.OR = [
        { title: { contains: String(keyword) } },
        { content: { contains: String(keyword) } }
      ];
    }

    const [list, total] = await Promise.all([
      prisma.content.findMany({
        where,
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          _count: { select: { likes: true, comments: true, collections: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.content.count({ where })
    ]);

    res.json({
      code: 'SUCCESS',
      data: {
        list: list.map(c => ({
          ...c,
          likeCount: c._count.likes,
          commentCount: c._count.comments,
          collectCount: c._count.collections
        })),
        total,
        page: Number(page),
        hasMore: skip + list.length < total
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.get('/content/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        _count: { select: { likes: true, comments: true, collections: true } }
      }
    });
    if (!content) return res.status(404).json({ code: 'NOT_FOUND', message: '内容不存在' });
    res.json({ code: 'SUCCESS', data: content });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.post('/content/:id/audit', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    // status: 'pass' | 'reject'
    const statusNum = status === 'pass' ? 1 : 2;
    await prisma.content.update({
      where: { id },
      data: { status: statusNum, rejectReason: reason || null }
    });
    res.json({ code: 'SUCCESS', message: status === 'pass' ? '审核通过' : '已驳回' });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.post('/content/:id/delete', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.content.update({ where: { id }, data: { status: 3 } });
    res.json({ code: 'SUCCESS', message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// ==================== 举报管理（Mock） ====================
const mockReports = [
  { id: 'r1', contentId: '', reporterName: '用户A', reason: '垃圾广告', status: 'pending', createdAt: new Date().toISOString() },
  { id: 'r2', contentId: '', reporterName: '用户B', reason: '色情内容', status: 'handled', result: 'valid', createdAt: new Date().toISOString() }
];

router.get('/report/list', adminAuth, async (req, res) => {
  res.json({ code: 'SUCCESS', data: { list: mockReports, total: mockReports.length } });
});

router.post('/report/:id/handle', adminAuth, async (req, res) => {
  const { id } = req.params;
  const report = mockReports.find(r => r.id === id);
  if (report) {
    (report as any).status = 'handled';
    (report as any).result = req.body.result;
  }
  res.json({ code: 'SUCCESS', message: '处理成功' });
});

// ==================== 标签管理（Mock） ====================
let mockTags = [
  { id: 't1', name: '家常菜', useCount: 1200, status: 1, createdAt: new Date().toISOString() },
  { id: 't2', name: '烘焙', useCount: 800, status: 1, createdAt: new Date().toISOString() },
  { id: 't3', name: '川菜', useCount: 600, status: 1, createdAt: new Date().toISOString() }
];

router.get('/tag/list', adminAuth, async (req, res) => {
  res.json({ code: 'SUCCESS', data: { list: mockTags, total: mockTags.length } });
});

router.post('/tag/create', adminAuth, async (req, res) => {
  const newTag = { id: `t${Date.now()}`, ...req.body, useCount: 0, createdAt: new Date().toISOString() };
  mockTags.push(newTag);
  res.json({ code: 'SUCCESS', data: newTag });
});

router.post('/tag/:id/update', adminAuth, async (req, res) => {
  mockTags = mockTags.map(t => t.id === req.params.id ? { ...t, ...req.body } : t);
  res.json({ code: 'SUCCESS', message: '更新成功' });
});

router.post('/tag/:id/delete', adminAuth, async (req, res) => {
  mockTags = mockTags.filter(t => t.id !== req.params.id);
  res.json({ code: 'SUCCESS', message: '删除成功' });
});

// ==================== 用户管理 ====================
router.get('/user/list', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status !== undefined && status !== '') where.status = Number(status);
    if (keyword) {
      where.OR = [
        { nickname: { contains: String(keyword) } },
        { phone: { contains: String(keyword) } }
      ];
    }

    const [list, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, nickname: true, avatar: true, phone: true,
          status: true, isVip: true, createdAt: true,
          _count: { select: { contents: true, followers: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip, take: Number(limit)
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      code: 'SUCCESS',
      data: {
        list: list.map(u => ({
          ...u,
          postCount: u._count.contents,
          followerCount: u._count.followers
        })),
        total, page: Number(page)
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.get('/user/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { contents: true, followers: true, follows: true } }
      }
    });
    if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' });
    res.json({ code: 'SUCCESS', data: { ...user, password: undefined } });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.post('/user/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    // status: 'normal'=1, 'mute'=2, 'ban'=3
    const statusMap: Record<string, number> = { normal: 1, mute: 2, ban: 3 };
    const statusNum = statusMap[status] || Number(status);
    await prisma.user.update({ where: { id }, data: { status: statusNum } });
    const msg = statusNum === 1 ? '恢复正常' : statusNum === 2 ? '已禁言' : '已封号';
    res.json({ code: 'SUCCESS', message: msg });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// ==================== 订单管理 ====================
router.get('/order/list', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (status !== undefined && status !== '') where.status = Number(status);

    const [list, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { user: { select: { id: true, nickname: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take: Number(limit)
      }),
      prisma.order.count({ where })
    ]);

    res.json({ code: 'SUCCESS', data: { list, total, page: Number(page) } });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.get('/order/:id', adminAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, nickname: true, phone: true } } }
    });
    if (!order) return res.status(404).json({ code: 'NOT_FOUND', message: '订单不存在' });
    res.json({ code: 'SUCCESS', data: order });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// ==================== 广告管理（Mock） ====================
let mockAds = [
  { id: 'a1', title: '春季美食节', image: 'https://picsum.photos/400/200?random=1', link: 'https://example.com', type: 1, status: 1, impressions: 5000, clicks: 200, createdAt: new Date().toISOString() },
  { id: 'a2', title: '厨具特卖', image: 'https://picsum.photos/400/200?random=2', link: 'https://example.com', type: 2, status: 1, impressions: 3000, clicks: 150, createdAt: new Date().toISOString() }
];

router.get('/ad/list', adminAuth, async (req, res) => {
  res.json({ code: 'SUCCESS', data: { list: mockAds, total: mockAds.length } });
});

router.post('/ad/create', adminAuth, async (req, res) => {
  const newAd = { id: `a${Date.now()}`, ...req.body, impressions: 0, clicks: 0, createdAt: new Date().toISOString() };
  mockAds.push(newAd);
  res.json({ code: 'SUCCESS', data: newAd });
});

router.post('/ad/:id/update', adminAuth, async (req, res) => {
  mockAds = mockAds.map(a => a.id === req.params.id ? { ...a, ...req.body } : a);
  res.json({ code: 'SUCCESS', message: '更新成功' });
});

router.post('/ad/:id/delete', adminAuth, async (req, res) => {
  mockAds = mockAds.filter(a => a.id !== req.params.id);
  res.json({ code: 'SUCCESS', message: '删除成功' });
});

// ==================== Banner 管理 ====================
router.get('/banner/list', adminAuth, async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] });
    res.json({ code: 'SUCCESS', data: { list: banners, total: banners.length } });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.post('/banner/create', adminAuth, async (req, res) => {
  try {
    const { title, image, link, type = 1, sort = 0, status = 1 } = req.body;
    if (!title || !image) return res.status(400).json({ code: 'PARAM_ERROR', message: '标题和图片必填' });
    const banner = await prisma.banner.create({ data: { title, image, link, type, sort, status } });
    res.json({ code: 'SUCCESS', data: banner });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.post('/banner/:id/update', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image, link, type, sort, status } = req.body;
    const banner = await prisma.banner.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(image !== undefined && { image }),
        ...(link !== undefined && { link }),
        ...(type !== undefined && { type }),
        ...(sort !== undefined && { sort }),
        ...(status !== undefined && { status })
      }
    });
    res.json({ code: 'SUCCESS', data: banner });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.post('/banner/:id/delete', adminAuth, async (req, res) => {
  try {
    await prisma.banner.delete({ where: { id: req.params.id } });
    res.json({ code: 'SUCCESS', message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// ==================== 话题管理 ====================
router.get('/topic/list', adminAuth, async (req, res) => {
  try {
    const topics = await prisma.topic.findMany({ orderBy: { postCount: 'desc' } });
    res.json({ code: 'SUCCESS', data: { list: topics, total: topics.length } });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.post('/topic/create', adminAuth, async (req, res) => {
  try {
    const { name, description, cover, isHot = false } = req.body;
    if (!name) return res.status(400).json({ code: 'PARAM_ERROR', message: '话题名称必填' });
    const topic = await prisma.topic.create({ data: { name, description, cover, isHot } });
    res.json({ code: 'SUCCESS', data: topic });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ code: 'DUPLICATE', message: '话题名称已存在' });
    }
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

router.post('/topic/:id/update', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, cover, isHot, status } = req.body;
    const topic = await prisma.topic.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(cover !== undefined && { cover }),
        ...(isHot !== undefined && { isHot }),
        ...(status !== undefined && { status })
      }
    });
    res.json({ code: 'SUCCESS', data: topic });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// ==================== 敏感词管理（Mock） ====================
let mockKeywords = [
  { id: 'k1', word: '广告', status: 1, createdAt: new Date().toISOString() },
  { id: 'k2', word: '赌博', status: 1, createdAt: new Date().toISOString() },
  { id: 'k3', word: '诈骗', status: 1, createdAt: new Date().toISOString() }
];

router.get('/keyword/list', adminAuth, async (req, res) => {
  res.json({ code: 'SUCCESS', data: { list: mockKeywords, total: mockKeywords.length } });
});

router.post('/keyword/create', adminAuth, async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ code: 'PARAM_ERROR', message: '敏感词必填' });
  const newKw = { id: `k${Date.now()}`, word, status: 1, createdAt: new Date().toISOString() };
  mockKeywords.push(newKw);
  res.json({ code: 'SUCCESS', data: newKw });
});

router.post('/keyword/:id/delete', adminAuth, async (req, res) => {
  mockKeywords = mockKeywords.filter(k => k.id !== req.params.id);
  res.json({ code: 'SUCCESS', message: '删除成功' });
});

// ==================== AI 统计（Mock） ====================
router.get('/ai/stats', adminAuth, async (req, res) => {
  res.json({
    code: 'SUCCESS',
    data: {
      totalCalls: 12580,
      successRate: 98.5,
      avgLatency: 1.2,
      todayCalls: 320,
      monthCalls: 8900,
      breakdown: {
        recipe: 4200,
        title: 3100,
        tags: 2800,
        polish: 1500,
        other: 980
      }
    }
  });
});

// ==================== 结算管理（Mock） ====================
const mockSettlements = [
  { id: 's1', userId: 'u1', userName: '美食达人小王', amount: 1200, status: 'pending', period: '2026-02', createdAt: new Date().toISOString() },
  { id: 's2', userId: 'u2', userName: '厨艺大师', amount: 3400, status: 'paid', period: '2026-02', createdAt: new Date().toISOString() }
];

router.get('/settlement/list', adminAuth, async (req, res) => {
  res.json({ code: 'SUCCESS', data: { list: mockSettlements, total: mockSettlements.length } });
});

router.post('/settlement/:id/handle', adminAuth, async (req, res) => {
  const settlement = mockSettlements.find(s => s.id === req.params.id);
  if (settlement) (settlement as any).status = req.body.status;
  res.json({ code: 'SUCCESS', message: '操作成功' });
});

// ==================== 用户统计 ====================
router.get('/stats/users', adminAuth, async (req, res) => {
  try {
    const total = await prisma.user.count();
    const active = await prisma.user.count({ where: { status: 1 } });
    const vip = await prisma.user.count({ where: { isVip: true } });

    // 近30天每天新增
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true }
    });

    const days: string[] = [];
    const trend: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dayStr = `${day.getMonth() + 1}/${day.getDate()}`;
      const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
      days.push(dayStr);
      trend.push(recentUsers.filter(u => u.createdAt >= dayStart && u.createdAt <= dayEnd).length);
    }

    res.json({ code: 'SUCCESS', data: { total, active, vip, trend: { days, values: trend } } });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// ==================== 内容统计 ====================
router.get('/stats/contents', adminAuth, async (req, res) => {
  try {
    const total = await prisma.content.count({ where: { status: 1 } });
    const pending = await prisma.content.count({ where: { status: 0 } });
    const rejected = await prisma.content.count({ where: { status: 2 } });

    res.json({ code: 'SUCCESS', data: { total, pending, rejected } });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

export default router;

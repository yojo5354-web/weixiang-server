import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'weixiang-secret-key-2024';

// 解析 Token 中间件
const auth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  }
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token无效' });
  }
};

// 获取首页内容列表（Feed）
router.get('/feed', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const contents = await prisma.content.findMany({
      where: { status: 1 },
      include: {
        user: {
          select: { id: true, nickname: true, avatar: true }
        },
        _count: {
          select: { likes: true, comments: true, collections: true }
        }
      },
      orderBy: [
        { isHot: 'desc' },
        { isTop: 'desc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: Number(limit)
    });

    const total = await prisma.content.count({ where: { status: 1 } });

    res.json({
      code: 'SUCCESS',
      data: {
        list: contents.map(c => ({
          ...c,
          likeCount: c._count.likes,
          commentCount: c._count.comments,
          collectCount: c._count.collections
        })),
        total,
        page: Number(page),
        limit: Number(limit),
        hasMore: skip + contents.length < total
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 搜索内容（必须在 /:id 之前）
router.get('/search', async (req, res) => {
  try {
    const { q = '', page = 1, limit = 10, type = 'content' } = req.query;
    const keyword = String(q).trim();
    const skip = (Number(page) - 1) * Number(limit);

    if (!keyword) {
      return res.json({ code: 'SUCCESS', data: { list: [], total: 0 } });
    }

    if (type === 'user') {
      const users = await prisma.user.findMany({
        where: { status: 1, OR: [{ nickname: { contains: keyword } }] },
        select: { id: true, nickname: true, avatar: true, bio: true },
        skip, take: Number(limit)
      });
      const total = await prisma.user.count({ where: { status: 1, OR: [{ nickname: { contains: keyword } }] } });
      return res.json({ code: 'SUCCESS', data: { list: users, total } });
    }

    const contents = await prisma.content.findMany({
      where: { status: 1, OR: [{ title: { contains: keyword } }, { content: { contains: keyword } }, { tags: { contains: keyword } }] },
      include: { user: { select: { id: true, nickname: true, avatar: true } }, _count: { select: { likes: true, comments: true, collections: true } } },
      orderBy: { createdAt: 'desc' }, skip, take: Number(limit)
    });

    const total = await prisma.content.count({
      where: { status: 1, OR: [{ title: { contains: keyword } }, { content: { contains: keyword } }, { tags: { contains: keyword } }] }
    });

    res.json({
      code: 'SUCCESS',
      data: {
        list: contents.map(c => ({ ...c, likeCount: c._count.likes, commentCount: c._count.comments, collectCount: c._count.collections })),
        total, hasMore: skip + contents.length < total
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取用户发布的内容列表（必须在 /:id 之前）
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const contents = await prisma.content.findMany({
      where: { userId, status: 1 },
      include: { user: { select: { id: true, nickname: true, avatar: true } } },
      orderBy: { createdAt: 'desc' }, skip, take: Number(limit)
    });
    const total = await prisma.content.count({ where: { userId, status: 1 } });
    res.json({ code: 'SUCCESS', data: { list: contents, page: Number(page), total, hasMore: skip + contents.length < total } });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 话题列表（必须在 /:id 之前）
router.get('/topic/list', async (req, res) => {
  try {
    const topics = await prisma.topic.findMany({
      where: { status: 1 },
      orderBy: [{ isHot: 'desc' }, { postCount: 'desc' }],
      take: 20
    });
    res.json({ code: 'SUCCESS', data: topics });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取内容详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, nickname: true, avatar: true }
        },
        comments: {
          where: { status: 1, parentId: null },
          include: {
            author: { select: { id: true, nickname: true, avatar: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!content) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '内容不存在' });
    }

    // 增加浏览量
    await prisma.content.update({
      where: { id },
      data: { viewCount: { increment: 1 } }
    });

    res.json({
      code: 'SUCCESS',
      data: {
        ...content,
        comments: (content.comments || []).map(c => ({
          id: c.id,
          content: c.content,
          user: c.author,
          likeCount: c.likeCount,
          createdAt: c.createdAt
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 发布内容
router.post('/', auth, async (req, res) => {
  try {
    const { title, coverImage, images, content, tags, topicId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: '标题和内容必填' });
    }

    const newContent = await prisma.content.create({
      data: {
        userId: req.userId,
        title,
        coverImage,
        images: JSON.stringify(images || []),
        content,
        tags: tags ? JSON.stringify(tags) : null,
        topicId,
        status: 1 // 演示环境直接通过审核
      },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } }
      }
    });

    res.json({
      code: 'SUCCESS',
      message: '发布成功',
      data: newContent
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 删除内容
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const content = await prisma.content.findUnique({ where: { id } });
    if (!content) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '内容不存在' });
    }
    if (content.userId !== req.userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: '无权删除' });
    }

    await prisma.content.update({
      where: { id },
      data: { status: 3 }
    });

    res.json({ code: 'SUCCESS', message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 添加评论
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content: commentText, parentId } = req.body;

    if (!commentText) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: '评论内容必填' });
    }

    const comment = await prisma.comment.create({
      data: {
        contentId: id,
        userId: req.userId,
        parentId,
        content: commentText
      },
      include: {
        author: { select: { id: true, nickname: true, avatar: true } }
      }
    });

    // 更新评论数
    await prisma.content.update({
      where: { id },
      data: { commentCount: { increment: 1 } }
    });

    res.json({
      code: 'SUCCESS',
      message: '评论成功',
      data: {
        id: comment.id,
        content: comment.content,
        user: comment.author,
        likeCount: comment.likeCount,
        createdAt: comment.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取评论列表
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const comments = await prisma.comment.findMany({
      where: { contentId: id, status: 1 },
      include: {
        author: { select: { id: true, nickname: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit)
    });

    res.json({
      code: 'SUCCESS',
      data: comments.map(c => ({
        id: c.id,
        content: c.content,
        user: c.author,
        likeCount: c.likeCount,
        createdAt: c.createdAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

export default router;

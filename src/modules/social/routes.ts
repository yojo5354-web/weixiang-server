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

// 点赞
router.post('/like', auth, async (req, res) => {
  try {
    const { contentId } = req.body;
    if (!contentId) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: 'contentId 必填' });
    }

    // 检查是否已点赞
    const existLike = await prisma.like.findUnique({
      where: { userId_contentId: { userId: req.userId, contentId } }
    });

    if (existLike) {
      // 取消点赞
      await prisma.like.delete({ where: { id: existLike.id } });
      await prisma.content.update({
        where: { id: contentId },
        data: { likeCount: { decrement: 1 } }
      });
      res.json({ code: 'SUCCESS', message: '已取消点赞', data: { liked: false } });
    } else {
      // 点赞
      await prisma.like.create({
        data: { userId: req.userId, contentId }
      });
      await prisma.content.update({
        where: { id: contentId },
        data: { likeCount: { increment: 1 } }
      });

      // 创建通知
      const content = await prisma.content.findUnique({ where: { id: contentId } });
      if (content && content.userId !== req.userId) {
        await prisma.notification.create({
          data: {
            userId: content.userId,
            type: 1,
            title: '收到点赞',
            content: '有人点赞了你的内容'
          }
        });
      }

      res.json({ code: 'SUCCESS', message: '点赞成功', data: { liked: true } });
    }
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 收藏
router.post('/collect', auth, async (req, res) => {
  try {
    const { contentId } = req.body;
    if (!contentId) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: 'contentId 必填' });
    }

    const existCollection = await prisma.collection.findUnique({
      where: { userId_contentId: { userId: req.userId, contentId } }
    });

    if (existCollection) {
      await prisma.collection.delete({ where: { id: existCollection.id } });
      await prisma.content.update({
        where: { id: contentId },
        data: { collectCount: { decrement: 1 } }
      });
      res.json({ code: 'SUCCESS', message: '已取消收藏', data: { collected: false } });
    } else {
      await prisma.collection.create({
        data: { userId: req.userId, contentId }
      });
      await prisma.content.update({
        where: { id: contentId },
        data: { collectCount: { increment: 1 } }
      });
      res.json({ code: 'SUCCESS', message: '收藏成功', data: { collected: true } });
    }
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 关注
router.post('/follow', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || userId === req.userId) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: 'userId 必填且不能是自己' });
    }

    const existFollow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId, followingId: userId } }
    });

    if (existFollow) {
      await prisma.follow.delete({ where: { id: existFollow.id } });
      res.json({ code: 'SUCCESS', message: '已取消关注', data: { following: false } });
    } else {
      await prisma.follow.create({
        data: { followerId: req.userId, followingId: userId }
      });

      // 创建通知
      await prisma.notification.create({
        data: {
          userId,
          type: 3,
          title: '新粉丝',
          content: '有人关注了你'
        }
      });

      res.json({ code: 'SUCCESS', message: '关注成功', data: { following: true } });
    }
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取关注列表
router.get('/following', auth, async (req, res) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { followerId: req.userId },
      include: {
        following: {
          select: { id: true, nickname: true, avatar: true, bio: true }
        }
      }
    });

    res.json({
      code: 'SUCCESS',
      data: follows.map(f => f.following)
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取粉丝列表
router.get('/followers', auth, async (req, res) => {
  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: req.userId },
      include: {
        follower: {
          select: { id: true, nickname: true, avatar: true, bio: true }
        }
      }
    });

    res.json({
      code: 'SUCCESS',
      data: followers.map(f => f.follower)
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取收藏列表
router.get('/collections', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const collections = await prisma.collection.findMany({
      where: { userId: req.userId },
      include: {
        content: {
          include: {
            user: { select: { id: true, nickname: true, avatar: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit)
    });

    res.json({
      code: 'SUCCESS',
      data: collections.map(c => c.content)
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取通知列表
router.get('/notifications', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ code: 'SUCCESS', data: notifications });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 标记通知已读
router.put('/notifications/read', auth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true }
    });

    res.json({ code: 'SUCCESS', message: '已标记已读' });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 发送私信
router.post('/message', auth, async (req, res) => {
  try {
    const { receiverId, content, type = 1 } = req.body;
    if (!receiverId || !content) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: 'receiverId 和 content 必填' });
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.userId,
        receiverId,
        content,
        type
      }
    });

    res.json({ code: 'SUCCESS', message: '发送成功', data: message });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取聊天列表
router.get('/messages', auth, async (req, res) => {
  try {
    // 获取与当前用户有聊天记录的所有用户
    const sentMessages = await prisma.message.findMany({
      where: { senderId: req.userId },
      select: { receiverId: true }
    });
    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: req.userId },
      select: { senderId: true }
    });

    const userIds = [...new Set([
      ...sentMessages.map(m => m.receiverId),
      ...receivedMessages.map(m => m.senderId)
    ])];

    // 获取每个用户的最新消息
    const conversations = await Promise.all(
      userIds.map(async (otherUserId) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: req.userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: req.userId }
            ]
          },
          orderBy: { createdAt: 'desc' }
        });

        const unreadCount = await prisma.message.count({
          where: { senderId: otherUserId, receiverId: req.userId, isRead: false }
        });

        const otherUser = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, nickname: true, avatar: true }
        });

        return {
          user: otherUser,
          lastMessage,
          unreadCount
        };
      })
    );

    res.json({
      code: 'SUCCESS',
      data: conversations
        .filter(c => c.user)
        .sort((a, b) => {
          const dateA = new Date(a.lastMessage?.createdAt || 0);
          const dateB = new Date(b.lastMessage?.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        })
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取与某个用户的聊天记录
router.get('/message/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.userId, receiverId: userId },
          { senderId: userId, receiverId: req.userId }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    // 标记为已读
    await prisma.message.updateMany({
      where: { senderId: userId, receiverId: req.userId, isRead: false },
      data: { isRead: true }
    });

    res.json({ code: 'SUCCESS', data: messages });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

export default router;

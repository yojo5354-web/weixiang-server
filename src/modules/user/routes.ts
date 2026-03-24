import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './client';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'weixiang-secret-key-2024';

// 内存存储验证码（生产环境应使用 Redis）
const smsCodes = new Map<string, { code: string; expiresAt: number }>();
// 内存存储微信登录状态
const wxLoginSessions = new Map<string, { userId?: string; status: 'pending' | 'scanned' | 'confirmed' | 'expired' }>();

// 生成6位验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 生成微信登录二维码ID
function generateWxSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// 发送验证码
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: '请输入正确的手机号' });
    }

    // 生成验证码
    const code = generateCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟过期

    // 存储验证码
    smsCodes.set(phone, { code, expiresAt });

    // 尝试使用腾讯云SMS发送真实短信
    const smsSent = await sendRealSMS(phone, code);
    
    if (smsSent) {
      console.log(`[腾讯云SMS] 验证码已发送至 ${phone}: ${code}`);
      res.json({
        code: 'SUCCESS',
        message: '验证码已发送',
        data: { expiresIn: 300 }
      });
    } else {
      // 降级到演示模式（未配置腾讯云SMS）
      console.log(`[演示] 向 ${phone} 发送验证码: ${code}`);
      res.json({
        code: 'SUCCESS',
        message: '验证码已发送（演示模式）',
        data: { 
          demoCode: code,
          expiresIn: 300 
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 腾讯云SMS发送函数
async function sendRealSMS(phone: string, code: string): Promise<boolean> {
  // 检查是否配置了腾讯云SMS
  const secretId = process.env.TENCENT_SMS_SECRET_ID;
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY;
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID;
  const signName = process.env.TENCENT_SMS_SIGN_NAME;
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID;

  if (!secretId || !secretKey || !sdkAppId || !signName || !templateId) {
    console.log('[腾讯云SMS] 未配置，跳过真实发送');
    return false;
  }

  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs');
    const smsClient = tencentcloud.sms.v20210111.Client;

    const client = new smsClient({
      credential: {
        secretId,
        secretKey,
      },
      region: 'ap-guangzhou',
      profile: {
        signMethod: 'HmacSHA256',
        httpProfile: {
          reqMethod: 'POST',
          reqTimeout: 30,
          endpoint: 'sms.tencentcloudapi.com',
        },
      },
    });

    const params = {
      SmsSdkAppId: sdkAppId,
      SignName: signName,
      TemplateId: templateId,
      TemplateParamSet: [code],
      PhoneNumberSet: [`+86${phone}`],
    };

    const response = await client.SendSms(params);
    console.log('[腾讯云SMS] 发送结果:', JSON.stringify(response));
    
    return response.SendStatusSet && response.SendStatusSet[0].Code === 'Ok';
  } catch (error: any) {
    console.error('[腾讯云SMS] 发送失败:', error.message);
    return false;
  }
}

// 验证码登录
router.post('/login-by-code', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: '手机号和验证码必填' });
    }

    // 验证验证码
    const stored = smsCodes.get(phone);
    if (!stored) {
      return res.status(400).json({ code: 'CODE_NOT_SENT', message: '请先获取验证码' });
    }
    if (stored.expiresAt < Date.now()) {
      smsCodes.delete(phone);
      return res.status(400).json({ code: 'CODE_EXPIRED', message: '验证码已过期' });
    }
    if (stored.code !== code) {
      return res.status(400).json({ code: 'CODE_ERROR', message: '验证码错误' });
    }

    // 验证码正确，删除已使用的验证码
    smsCodes.delete(phone);

    // 查找或创建用户
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          nickname: `美食达人${phone.slice(-4)}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${phone}`,
        }
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      code: 'SUCCESS',
      message: '登录成功',
      data: { user, token }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 微信登录 - 获取二维码
router.get('/wx/qrcode', async (req, res) => {
  try {
    const sessionId = generateWxSessionId();
    const sceneStr = `wx_login_${sessionId}`;
    
    // 创建登录会话
    wxLoginSessions.set(sessionId, { status: 'pending' });

    // 模拟二维码URL（实际应生成微信二维码）
    const qrcodeUrl = `weixiang://login?scene=${sceneStr}`;

    res.json({
      code: 'SUCCESS',
      data: {
        sessionId,
        qrcodeUrl,
        // 演示用：实际应该返回二维码图片
        demoUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrcodeUrl)}`
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 微信登录 - 轮询检查扫码状态
router.get('/wx/poll/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = wxLoginSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ code: 'SESSION_NOT_FOUND', message: '二维码已过期' });
    }

    if (session.status === 'expired') {
      wxLoginSessions.delete(sessionId);
      return res.json({
        code: 'SUCCESS',
        data: { status: 'expired' }
      });
    }

    if (session.status === 'confirmed' && session.userId) {
      // 用户已确认，获取用户信息并登录
      wxLoginSessions.delete(sessionId);
      
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        return res.status(404).json({ code: 'USER_NOT_FOUND', message: '用户不存在' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

      return res.json({
        code: 'SUCCESS',
        data: {
          status: 'confirmed',
          user,
          token
        }
      });
    }

    res.json({
      code: 'SUCCESS',
      data: { status: session.status }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 微信登录 - 模拟扫码（演示用）
router.post('/wx/scan-demo', async (req, res) => {
  try {
    const { sessionId, phone, action } = req.body;

    // action: 'scan' | 'confirm' | 'expire'
    const session = wxLoginSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ code: 'SESSION_NOT_FOUND', message: '二维码不存在' });
    }

    if (action === 'expire') {
      session.status = 'expired';
      return res.json({ code: 'SUCCESS', message: '已过期' });
    }

    // 查找用户
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          nickname: `美食达人${phone.slice(-4)}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${phone}`,
        }
      });
    }

    if (action === 'scan') {
      session.status = 'scanned';
      session.userId = user.id;
      return res.json({ code: 'SUCCESS', message: '已扫码' });
    }

    if (action === 'confirm') {
      session.status = 'confirmed';
      session.userId = user.id;
      return res.json({ code: 'SUCCESS', message: '已确认' });
    }

    res.json({ code: 'SUCCESS' });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 注册
router.post('/register', async (req, res) => {
  try {
    const { phone, code, nickname, password } = req.body;

    // 验证验证码（如果有）
    if (code) {
      const stored = smsCodes.get(phone);
      if (!stored || stored.code !== code || stored.expiresAt < Date.now()) {
        return res.status(400).json({ code: 'CODE_ERROR', message: '验证码错误或已过期' });
      }
      smsCodes.delete(phone);
    }

    // 简化验证：注册必须有昵称
    if (!phone || !nickname) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: '手机号和昵称必填' });
    }

    // 检查用户是否已存在
    const existUser = await prisma.user.findUnique({ where: { phone } });
    if (existUser) {
      return res.status(400).json({ code: 'USER_EXIST', message: '用户已存在' });
    }

    // 创建用户
    const user = await prisma.user.create({
      data: {
        phone,
        nickname,
        avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${phone}`,
      }
    });

    // 生成 Token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      code: 'SUCCESS',
      message: '注册成功',
      data: { user, token }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 登录（手机号直接登录，演示用）
router.post('/login', async (req, res) => {
  try {
    const { phone, code } = req.body;

    // 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ code: 'PARAM_ERROR', message: '请输入正确的11位手机号' });
    }

    // 如果有验证码，先验证
    if (code) {
      const stored = smsCodes.get(phone);
      if (!stored || stored.code !== code || stored.expiresAt < Date.now()) {
        return res.status(400).json({ code: 'CODE_ERROR', message: '验证码错误或已过期' });
      }
      smsCodes.delete(phone);
    }

    // 查找或创建用户（演示环境）
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          nickname: `用户${phone.slice(-4)}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${phone}`,
        }
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      code: 'SUCCESS',
      message: '登录成功',
      data: { user, token }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 获取用户信息
router.get('/info', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        _count: {
          select: {
            contents: true,
            followers: true,
            follows: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: '用户不存在' });
    }

    res.json({
      code: 'SUCCESS',
      data: {
        ...user,
        password: undefined,
        postCount: user._count.contents,
        followerCount: user._count.followers,
        followingCount: user._count.follows
      }
    });
  } catch (error: any) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token无效' });
  }
});

// 获取其他用户信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        contents: {
          where: { status: 1 },
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            contents: { where: { status: 1 } },
            followers: true,
            follows: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: '用户不存在' });
    }

    res.json({
      code: 'SUCCESS',
      data: {
        ...user,
        password: undefined,
        postCount: user._count.contents,
        followerCount: user._count.followers,
        followingCount: user._count.follows
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 更新用户信息
router.put('/update', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const { nickname, avatar, bio, gender, birthday, location } = req.body;

    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        ...(nickname && { nickname }),
        ...(avatar && { avatar }),
        ...(bio && { bio }),
        ...(gender !== undefined && { gender }),
        ...(birthday && { birthday: new Date(birthday) }),
        ...(location && { location }),
      }
    });

    res.json({
      code: 'SUCCESS',
      message: '更新成功',
      data: user
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

export default router;

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

// 拍照生成食谱（演示版 - 实际需要腾讯混元API）
router.post('/generate-recipe', auth, async (req, res) => {
  try {
    const { imageUrl } = req.body;

    // 演示返回模拟数据
    // 实际需要调用腾讯混元多模态模型分析图片
    const mockRecipe = {
      title: '家常红烧肉',
      coverImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
      ingredients: [
        '五花肉 500g',
        '生抽 30ml',
        '老抽 15ml',
        '冰糖 30g',
        '八角 2个',
        '桂皮 1小块',
        '香叶 2片',
        '葱姜适量'
      ],
      steps: [
        '五花肉切成3cm见方的块，冷水下锅焯水去血沫',
        '锅中放少许油，加入冰糖小火炒至焦糖色',
        '放入五花肉翻炒上色，加入葱姜八角桂皮香叶',
        '加入生抽老抽料酒，加开水没过肉',
        '大火烧开转小火炖1小时，收汁即可'
      ],
      difficulty: 2,
      duration: 90,
      tips: '炒糖色时火候要小，颜色变深即可不要炒糊'
    };

    res.json({
      code: 'SUCCESS',
      message: 'AI 生成成功',
      data: mockRecipe
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// AI 生成内容标题和摘要
router.post('/generate-title', auth, async (req, res) => {
  try {
    const { content } = req.body;

    // 演示返回模拟数据
    const suggestions = [
      { title: '🔥这也太香了吧！学会这招在家也能做出餐厅级美味', hot: 98 },
      { title: '厨房小白必看！简单几步做出惊艳家常菜', hot: 85 },
      { title: '私房秘方大公开，学会就是赚到', hot: 92 }
    ];

    res.json({
      code: 'SUCCESS',
      data: suggestions
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// AI 生成封面图描述
router.post('/generate-cover-prompt', auth, async (req, res) => {
  try {
    const { content } = req.body;

    // 演示返回模拟数据
    const prompts = [
      '专业美食摄影，浅色背景俯拍，4K高清，食欲感强',
      '生活化场景，暖色调，自然光线，精美食器',
      'ins风格，留白多，文字空间充足，简洁大气'
    ];

    res.json({
      code: 'SUCCESS',
      data: prompts
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// AI 智能标签
router.post('/generate-tags', auth, async (req, res) => {
  try {
    const { content, imageUrl } = req.body;

    // 演示返回模拟数据
    const tags = [
      { name: '家常菜', count: 12580 },
      { name: '下饭菜', count: 8920 },
      { name: '快手菜', count: 6540 },
      { name: '猪肉', count: 4230 },
      { name: '下饭神器', count: 3100 }
    ];

    res.json({
      code: 'SUCCESS',
      data: tags
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// AI 文案润色
router.post('/polish-content', auth, async (req, res) => {
  try {
    const { content } = req.body;

    // 演示返回模拟数据
    const polished = content + '\n\n✨小贴士：炒菜时火候很关键，大火快炒能保持蔬菜的清脆口感哦～';

    res.json({
      code: 'SUCCESS',
      data: { content: polished }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 语音转文字（演示版 - 实际需要腾讯ASR）
router.post('/voice-to-text', auth, async (req, res) => {
  try {
    const { audioUrl } = req.body;

    // 演示返回模拟数据
    const text = '帮我把第三步的火候改大一点，时间延长5分钟';

    res.json({
      code: 'SUCCESS',
      data: { text }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// AI 内容修改建议
router.post('/modify-content', auth, async (req, res) => {
  try {
    const { content, instruction } = req.body;

    // 演示返回模拟数据
    const modified = content.replace('中火', '大火').replace('10分钟', '15分钟');

    res.json({
      code: 'SUCCESS',
      message: '已根据您的要求修改',
      data: { content: modified }
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 营养分析
router.post('/nutrition-analysis', auth, async (req, res) => {
  try {
    const { ingredients } = req.body;

    // 演示返回模拟数据
    const nutrition = {
      calories: 580,
      protein: 25.5,
      fat: 32.8,
      carbs: 18.6,
      fiber: 3.2,
      sodium: 890
    };

    res.json({
      code: 'SUCCESS',
      data: nutrition
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

// 相似食谱推荐
router.post('/similar-recipes', auth, async (req, res) => {
  try {
    const { contentId } = req.body;

    // 演示返回模拟数据
    const recipes = [
      {
        id: '1',
        title: '秘制红烧排骨',
        cover: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
        author: '美食达人小王',
        likes: 2300
      },
      {
        id: '2',
        title: '糖醋里脊',
        cover: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400',
        author: '厨房时光',
        likes: 1890
      },
      {
        id: '3',
        title: '可乐鸡翅',
        cover: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400',
        author: '吃货日记',
        likes: 3200
      }
    ];

    res.json({
      code: 'SUCCESS',
      data: recipes
    });
  } catch (error: any) {
    res.status(500).json({ code: 'ERROR', message: error.message });
  }
});

export default router;

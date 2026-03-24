const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建演示数据...');

  // 创建演示用户
  const users = await Promise.all([
    prisma.user.upsert({
      where: { phone: '13800138001' },
      update: {},
      create: {
        phone: '13800138001',
        nickname: '美食记',
        avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=foodie1',
        bio: '热爱美食，分享每一道菜的独特风味 🍜',
        gender: 2,
        location: '北京',
        isVip: true,
      },
    }),
    prisma.user.upsert({
      where: { phone: '13800138002' },
      update: {},
      create: {
        phone: '13800138002',
        nickname: '厨房小当家',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=foodie2',
        bio: '在家也能做出餐厅级美味',
        gender: 1,
        location: '上海',
      },
    }),
    prisma.user.upsert({
      where: { phone: '13800138003' },
      update: {},
      create: {
        phone: '13800138003',
        nickname: '减脂餐专家',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=foodie3',
        bio: '健康饮食，轻松享瘦 💪',
        gender: 1,
        location: '广州',
        isVip: true,
      },
    }),
  ]);

  console.log(`✅ 创建了 ${users.length} 个用户`);

  // 创建话题
  const topics = await Promise.all([
    prisma.topic.upsert({
      where: { name: '快手早餐' },
      update: {},
      create: {
        name: '快手早餐',
        description: '10分钟搞定营养早餐',
        postCount: 12580,
        isHot: true,
      },
    }),
    prisma.topic.upsert({
      where: { name: '家常菜' },
      update: {},
      create: {
        name: '家常菜',
        description: '简单易学的家常美味',
        postCount: 28930,
        isHot: true,
      },
    }),
    prisma.topic.upsert({
      where: { name: '减脂餐' },
      update: {},
      create: {
        name: '减脂餐',
        description: '健康美味的减脂食谱',
        postCount: 8920,
        isHot: true,
      },
    }),
    prisma.topic.upsert({
      where: { name: '甜品烘焙' },
      update: {},
      create: {
        name: '甜品烘焙',
        description: '甜蜜时光，烘焙幸福',
        postCount: 15640,
        isHot: false,
      },
    }),
    prisma.topic.upsert({
      where: { name: '下饭菜' },
      update: {},
      create: {
        name: '下饭菜',
        description: '超级无敌下饭神器',
        postCount: 21350,
        isHot: true,
      },
    }),
  ]);

  console.log(`✅ 创建了 ${topics.length} 个话题`);

  // 创建内容
  const contents = await Promise.all([
    prisma.content.create({
      data: {
        userId: users[0].id,
        title: '🔥 5分钟搞定营养早餐，一周不重样！',
        coverImage: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800',
          'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
          'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
        ]),
        content: '今天分享5款超简单的营养早餐，5分钟搞定！\n\n1. 鸡蛋三明治 + 牛奶\n2. 燕麦粥 + 水果\n3. 全麦吐司 + 牛油果\n4. 豆浆 + 油条\n5. 水果沙拉 + 酸奶\n\n每天早起10分钟，就能吃到美味又健康的早餐，赶紧试试吧！',
        tags: JSON.stringify(['快手早餐', '营养早餐', '减脂餐']),
        topicId: topics[0].id,
        status: 1,
        viewCount: 2356,
        likeCount: 328,
        commentCount: 45,
        isHot: true,
      },
    }),
    prisma.content.create({
      data: {
        userId: users[1].id,
        title: '🍳 完美溏心蛋的秘诀，看完就会！',
        coverImage: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=800',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=800',
          'https://images.unsplash.com/photo-1482049016-b2e1e5b15f1e?w=800',
        ]),
        content: '溏心蛋很多人都爱吃，但总是做不好。今天教大家一个超级简单的方法！\n\n⏱️ 煮蛋时间：\n- 6分钟：完全溏心\n- 7分钟：溏心偏硬\n- 8分钟：全熟\n\n💡 小技巧：\n1. 冰箱里的蛋要先回温\n2. 水开后放蛋\n3. 煮好后立刻放冰水\n\n这样做出来的溏心蛋，蛋黄流心，蛋白嫩滑，完美！',
        tags: JSON.stringify(['溏心蛋', '水煮蛋', '早餐']),
        topicId: topics[1].id,
        status: 1,
        viewCount: 1892,
        likeCount: 256,
        commentCount: 38,
        isHot: true,
      },
    }),
    prisma.content.create({
      data: {
        userId: users[2].id,
        title: '🥗 鸡胸肉这样做，一点都不柴！',
        coverImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
          'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
        ]),
        content: '减脂期必吃的鸡胸肉，很多人都觉得又柴又硬。那是因为你做错了！\n\n🔥 关键步骤：\n1. 用锤子把鸡胸肉敲松\n2. 用盐水浸泡30分钟\n3. 大火快煎，每面1-2分钟\n4. 立刻出锅醒肉\n\n配上我的秘制酱汁：生抽+醋+蒜末+小米辣，绝了！\n\n这样做的鸡胸肉，又嫩又多汁，减脂期也能大口吃肉！',
        tags: JSON.stringify(['减脂餐', '鸡胸肉', '健身餐']),
        topicId: topics[2].id,
        status: 1,
        viewCount: 3456,
        likeCount: 512,
        commentCount: 67,
        isHot: true,
      },
    }),
    prisma.content.create({
      data: {
        userId: users[0].id,
        title: '🍰 零失败！入口即化的提拉米苏',
        coverImage: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
        ]),
        content: '今天分享一个零失败的提拉米苏做法！\n\n🍴 材料：\n- 马斯卡彭奶酪 250g\n- 淡奶油 200ml\n- 浓缩咖啡 200ml\n- 手指饼干 200g\n- 蛋黄 2个\n- 糖粉 50g\n- 可可粉 适量\n\n✨ 做法超简单：\n1. 蛋黄+糖粉打发\n2. 加入马斯卡彭搅拌\n3. 淡奶油打至六分发\n4. 混合所有材料\n5. 冷藏4小时以上\n\n入口即化，咖啡香浓郁，比店里卖的还好吃！',
        tags: JSON.stringify(['甜品', '提拉米苏', '意式甜点']),
        topicId: topics[3].id,
        status: 1,
        viewCount: 2890,
        likeCount: 423,
        commentCount: 52,
        isHot: false,
      },
    }),
    prisma.content.create({
      data: {
        userId: users[1].id,
        title: '🍜 这道麻婆豆腐，我能吃三碗饭！',
        coverImage: 'https://images.unsplash.com/photo-1582452932280-991140ae96f1?w=800',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1582452932280-991140ae96f1?w=800',
        ]),
        content: '麻婆豆腐绝对是下饭神器！每次做这个，都能多吃两碗饭！\n\n🌶️ 食材：\n- 嫩豆腐 1盒\n- 肉末 100g\n- 豆瓣酱 2勺\n- 花椒粉 适量\n- 蒜末 葱花\n\n👨‍🍳 做法：\n1. 豆腐切块焯水\n2. 热油爆香蒜末肉末\n3. 加豆瓣酱炒出红油\n4. 加水烧开，放豆腐\n5. 煮5分钟，水淀粉勾芡\n6. 出锅撒花椒粉和葱花\n\n豆腐嫩滑，麻辣鲜香，拌饭绝了！',
        tags: JSON.stringify(['川菜', '麻婆豆腐', '下饭菜']),
        topicId: topics[4].id,
        status: 1,
        viewCount: 4123,
        likeCount: 678,
        commentCount: 89,
        isHot: true,
      },
    }),
  ]);

  console.log(`✅ 创建了 ${contents.length} 条内容`);

  // 创建 Banner
  await prisma.banner.createMany({
    data: [
      {
        title: '新用户专享',
        image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200',
        type: 4,
        link: '/login',
        sort: 1,
        status: 1,
      },
      {
        title: '春季美食节',
        image: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=1200',
        type: 1,
        sort: 2,
        status: 1,
      },
    ],
  });

  console.log('✅ 创建了 Banner');

  console.log('\n🎉 演示数据创建完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

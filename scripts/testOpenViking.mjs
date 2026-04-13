#!/usr/bin/env node
/**
 * OpenViking 集成测试脚本
 * 用于测试 FastGPT 与 OpenViking 的集成
 *
 * 使用方法：
 * 1. 确保 OpenViking 服务已启动（docker ps）
 * 2. 确保 FastGPT 服务已启动（pnpm dev）
 * 3. 运行此脚本：node scripts/testOpenViking.mjs <datasetId>
 */

const OPENVIKING_ENDPOINT = process.env.OPENVIKING_ENDPOINT || 'http://localhost:1933';
const FASTGPT_ENDPOINT = process.env.FASTGPT_ENDPOINT || 'http://localhost:3000';

// 从命令行参数获取
const datasetId = process.argv[2];
const apiKey = process.argv[3] || process.env.FASTGPT_API_KEY || '';

if (!datasetId) {
  console.error('❌ 请提供数据集 ID');
  console.log('使用方法: node scripts/testOpenViking.mjs <datasetId> [apiKey]');
  process.exit(1);
}

/**
 * 检查 OpenViking 服务健康状态
 */
async function checkOpenVikingHealth() {
  console.log('\n🔍 检查 OpenViking 服务...');
  try {
    const response = await fetch(`${OPENVIKING_ENDPOINT}/api/v1/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ OpenViking 服务运行正常');
      console.log('   状态:', data.status);
      return true;
    } else {
      console.error('❌ OpenViking 服务响应异常:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ 无法连接 OpenViking 服务:', error.message);
    console.log('   请确保 OpenViking 服务已启动:');
    console.log('   docker run -d --name openviking -p 1933:1933 ghcr.io/volcengine/openviking:main');
    return false;
  }
}

/**
 * 同步数据集到 OpenViking
 */
async function syncDataset() {
  console.log('\n📦 同步数据集到 OpenViking...');
  console.log('   数据集 ID:', datasetId);

  try {
    const response = await fetch(`${FASTGPT_ENDPOINT}/api/core/dataset/openVikingSync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        datasetId,
        mode: 'full'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 同步失败:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    console.log('✅ 同步成功');
    console.log('   状态:', result.status);
    if (result.stats) {
      console.log('   集合数:', result.stats.totalCollections);
      console.log('   数据块数:', result.stats.totalChunks);
      console.log('   耗时:', result.stats.duration.toFixed(2), '秒');
    }
    return result;
  } catch (error) {
    console.error('❌ 同步请求失败:', error.message);
    return null;
  }
}

/**
 * 执行搜索测试
 */
async function testSearch(query, options = {}) {
  console.log('\n🔍 执行搜索测试...');
  console.log('   查询:', query);
  console.log('   模式:', options.useIterative ? '迭代检索' : '跨文档检索');

  try {
    const response = await fetch(`${FASTGPT_ENDPOINT}/api/core/dataset/openVikingSearch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        datasetId,
        text: query,
        limit: options.limit || 10,
        scoreThreshold: options.scoreThreshold || 0.3,
        useRelations: options.useRelations !== false,
        useIterative: options.useIterative || false,
        maxIterations: options.maxIterations || 3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 搜索失败:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    console.log('✅ 搜索完成');
    console.log('   耗时:', result.duration);
    console.log('   结果数:', result.list.length);
    if (result.uniqueFileCount) {
      console.log('   唯一文件数:', result.uniqueFileCount);
    }
    if (result.iterationCount) {
      console.log('   迭代次数:', result.iterationCount);
    }

    // 显示搜索结果
    if (result.list.length > 0) {
      console.log('\n📄 搜索结果:');
      result.list.forEach((item, index) => {
        console.log(`\n   [${index + 1}] 分数: ${item.score.toFixed(3)}`);
        console.log(`   问题: ${item.q.substring(0, 100)}${item.q.length > 100 ? '...' : ''}`);
        if (item.a) {
          console.log(`   答案: ${item.a.substring(0, 100)}${item.a.length > 100 ? '...' : ''}`);
        }
        if (item.relations && item.relations.length > 0) {
          console.log(`   关联文档: ${item.relations.length} 个`);
        }
      });
    }

    return result;
  } catch (error) {
    console.error('❌ 搜索请求失败:', error.message);
    return null;
  }
}

/**
 * 主测试流程
 */
async function main() {
  console.log('========================================');
  console.log('   OpenViking 集成测试');
  console.log('========================================');
  console.log('OpenViking 端点:', OPENVIKING_ENDPOINT);
  console.log('FastGPT 端点:', FASTGPT_ENDPOINT);
  console.log('数据集 ID:', datasetId);

  // 1. 检查 OpenViking 服务
  const openVikingHealthy = await checkOpenVikingHealth();
  if (!openVikingHealthy) {
    process.exit(1);
  }

  // 2. 同步数据集
  const syncResult = await syncDataset();
  if (!syncResult) {
    console.log('\n⚠️  同步失败，尝试直接搜索...');
  }

  // 3. 测试跨文档搜索
  await testSearch('合同违约', {
    limit: 5,
    useRelations: true
  });

  // 4. 测试迭代搜索
  console.log('\n----------------------------------------');
  await testSearch('违约责任', {
    limit: 5,
    useIterative: true,
    maxIterations: 2
  });

  console.log('\n========================================');
  console.log('   测试完成');
  console.log('========================================');
}

main().catch(console.error);

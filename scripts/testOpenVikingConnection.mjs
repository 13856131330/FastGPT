#!/usr/bin/env node
/**
 * OpenViking 连接测试脚本
 * 用于验证 OpenViking 服务是否正常运行
 */

const OPENVIKING_ENDPOINT = process.env.OPENVIKING_ENDPOINT || 'http://localhost:1933';

async function testConnection() {
  console.log('========================================');
  console.log('   OpenViking 连接测试');
  console.log('========================================');
  console.log('端点:', OPENVIKING_ENDPOINT);
  console.log();

  // 1. 健康检查
  console.log('1. 检查服务健康状态...');
  try {
    const healthResponse = await fetch(`${OPENVIKING_ENDPOINT}/api/v1/health`);
    if (healthResponse.ok) {
      console.log('   ✅ OpenViking 服务运行正常');
    } else {
      console.log('   ❌ 服务响应异常:', healthResponse.status);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 无法连接到 OpenViking');
    console.log('   错误:', error.message);
    console.log();
    console.log('   请确保 OpenViking 服务已启动:');
    console.log('   docker ps | grep openviking');
    console.log();
    console.log('   如果未启动，请运行:');
    console.log('   docker run -d --name openviking -p 1933:1933 ghcr.io/volcengine/openviking:main');
    return false;
  }

  // 2. 列出根目录
  console.log();
  console.log('2. 检查文件系统...');
  try {
    const lsResponse = await fetch(`${OPENVIKING_ENDPOINT}/api/v1/fs/ls?uri=viking://`);
    if (lsResponse.ok) {
      const data = await lsResponse.json();
      console.log('   ✅ 文件系统正常');
      if (data.entries && data.entries.length > 0) {
        console.log('   根目录内容:');
        data.entries.forEach(entry => {
          console.log(`     - ${entry.name} (${entry.type})`);
        });
      } else {
        console.log('   根目录为空（这是正常的，数据将通过同步添加）');
      }
    }
  } catch (error) {
    console.log('   ⚠️  文件系统检查失败:', error.message);
  }

  // 3. 测试搜索（空搜索）
  console.log();
  console.log('3. 测试搜索接口...');
  try {
    const searchResponse = await fetch(`${OPENVIKING_ENDPOINT}/api/v1/search/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', limit: 1 })
    });
    if (searchResponse.ok) {
      console.log('   ✅ 搜索接口正常');
    } else {
      console.log('   ⚠️  搜索接口响应异常:', searchResponse.status);
    }
  } catch (error) {
    console.log('   ❌ 搜索接口测试失败:', error.message);
  }

  console.log();
  console.log('========================================');
  console.log('   测试完成');
  console.log('========================================');
  console.log();
  console.log('下一步：');
  console.log('1. 确保 FastGPT 服务已启动 (pnpm dev)');
  console.log('2. 调用同步 API 将数据集同步到 OpenViking');
  console.log('3. 使用搜索 API 测试检索效果');
  console.log();

  return true;
}

testConnection().catch(console.error);

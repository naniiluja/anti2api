import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAssistantResponse, generateAssistantResponseNoStream, getAvailableModels, generateImageForSD, closeRequester } from '../api/client.js';
import { generateRequestBody, prepareImageRequest } from '../utils/utils.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import tokenManager from '../auth/token_manager.js';
import adminRouter from '../routes/admin.js';
import sdRouter from '../routes/sd.js';
import memoryManager, { MemoryPressure, registerMemoryPoolCleanup } from '../utils/memoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ==================== 通用重试工具（处理 429） ====================
const with429Retry = async (fn, maxRetries, loggerPrefix = '') => {
  const retries = Number.isFinite(maxRetries) && maxRetries > 0 ? Math.floor(maxRetries) : 0;
  let attempt = 0;
  // 首次执行 + 最多 retries 次重试
  while (true) {
    try {
      return await fn(attempt);
    } catch (error) {
      const status = Number(error.status || error.response?.status);
      if (status === 429 && attempt < retries) {
        const nextAttempt = attempt + 1;
        logger.warn(`${loggerPrefix}收到 429，正在进行第 ${nextAttempt} 次重试（共 ${retries} 次）`);
        attempt = nextAttempt;
        continue;
      }
      throw error;
    }
  }
};

// ==================== 心跳机制（防止 CF 超时） ====================
const HEARTBEAT_INTERVAL = config.server.heartbeatInterval || 15000; // 从配置读取心跳间隔
const SSE_HEARTBEAT = Buffer.from(': heartbeat\n\n');

// 创建心跳定时器
const createHeartbeat = (res) => {
  const timer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(SSE_HEARTBEAT);
    } else {
      clearInterval(timer);
    }
  }, HEARTBEAT_INTERVAL);
  
  // 响应结束时清理
  res.on('close', () => clearInterval(timer));
  res.on('finish', () => clearInterval(timer));
  
  return timer;
};

// 预编译的常量字符串（避免重复创建）
const SSE_PREFIX = Buffer.from('data: ');
const SSE_SUFFIX = Buffer.from('\n\n');
const SSE_DONE = Buffer.from('data: [DONE]\n\n');

// 工具函数：生成响应元数据
const createResponseMeta = () => ({
  id: `chatcmpl-${Date.now()}`,
  created: Math.floor(Date.now() / 1000)
});

// 工具函数：设置流式响应头
const setStreamHeaders = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
};

// 工具函数：构建流式数据块（使用动态对象池减少 GC）
// 支持 DeepSeek 格式的 reasoning_content
const chunkPool = [];
const getChunkObject = () => chunkPool.pop() || { choices: [{ index: 0, delta: {}, finish_reason: null }] };
const releaseChunkObject = (obj) => {
  const maxSize = memoryManager.getPoolSizes().chunk;
  if (chunkPool.length < maxSize) chunkPool.push(obj);
};

// 注册内存清理回调（使用统一工具收缩对象池）
registerMemoryPoolCleanup(chunkPool, () => memoryManager.getPoolSizes().chunk);

// 启动内存管理器
memoryManager.start(30000);

const createStreamChunk = (id, created, model, delta, finish_reason = null) => {
  const chunk = getChunkObject();
  chunk.id = id;
  chunk.object = 'chat.completion.chunk';
  chunk.created = created;
  chunk.model = model;
  chunk.choices[0].delta = delta;
  chunk.choices[0].finish_reason = finish_reason;
  return chunk;
};

// 工具函数：零拷贝写入流式数据
const writeStreamData = (res, data) => {
  const json = JSON.stringify(data);
  // 释放对象回池
  if (data.choices) releaseChunkObject(data);
  res.write(SSE_PREFIX);
  res.write(json);
  res.write(SSE_SUFFIX);
};

// 工具函数：结束流式响应
const endStream = (res) => {
  if (res.writableEnded) return;
  res.write(SSE_DONE);
  res.end();
};

// OpenAI 兼容错误响应构造
const buildOpenAIErrorPayload = (error, statusCode) => {
  if (error.isUpstreamApiError && error.rawBody) {
    try {
      const raw = typeof error.rawBody === 'string' ? JSON.parse(error.rawBody) : error.rawBody;
      const inner = raw.error || raw;
      return {
        error: {
          message: inner.message || error.message || 'Upstream API error',
          type: inner.type || 'upstream_api_error',
          code: inner.code ?? statusCode
        }
      };
    } catch {
      return {
        error: {
          message: error.rawBody || error.message || 'Upstream API error',
          type: 'upstream_api_error',
          code: statusCode
        }
      };
    }
  }

  return {
    error: {
      message: error.message || 'Internal server error',
      type: 'server_error',
      code: statusCode
    }
  };
};

app.use(cors());
app.use(express.json({ limit: config.security.maxRequestSize }));

// 静态文件服务
app.use('/images', express.static(path.join(__dirname, '../../public/images')));
app.use(express.static(path.join(__dirname, '../../public')));

// 管理路由
app.use('/admin', adminRouter);

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: `请求体过大，最大支持 ${config.security.maxRequestSize}` });
  }
  next(err);
});

app.use((req, res, next) => {
  const ignorePaths = ['/images', '/favicon.ico', '/.well-known', '/sdapi/v1/options', '/sdapi/v1/samplers', '/sdapi/v1/schedulers', '/sdapi/v1/upscalers', '/sdapi/v1/latent-upscale-modes', '/sdapi/v1/sd-vae', '/sdapi/v1/sd-modules'];
  if (!ignorePaths.some(path => req.path.startsWith(path))) {
    const start = Date.now();
    res.on('finish', () => {
      logger.request(req.method, req.path, res.statusCode, Date.now() - start);
    });
  }
  next();
});
app.use('/sdapi/v1', sdRouter);

app.use((req, res, next) => {
  if (req.path.startsWith('/v1/')) {
    const apiKey = config.security?.apiKey;
    if (apiKey) {
      const authHeader = req.headers.authorization;
      const providedKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      if (providedKey !== apiKey) {
        logger.warn(`API Key 验证失败: ${req.method} ${req.path}`);
        return res.status(401).json({ error: 'Invalid API Key' });
      }
    }
  }
  next();
});

app.get('/v1/models', async (req, res) => {
  try {
    const models = await getAvailableModels();
    res.json(models);
  } catch (error) {
    logger.error('获取模型列表失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 内存监控端点
app.get('/v1/memory', (req, res) => {
  const usage = process.memoryUsage();
  res.json({
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    rss: usage.rss,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    pressure: memoryManager.getCurrentPressure(),
    poolSizes: memoryManager.getPoolSizes(),
    chunkPoolSize: chunkPool.length
  });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});



app.post('/v1/chat/completions', async (req, res) => {
  const { messages, model, stream = false, tools, ...params} = req.body;
  try {
    if (!messages) {
      return res.status(400).json({ error: 'messages is required' });
    }
    const token = await tokenManager.getToken();
    if (!token) {
      throw new Error('没有可用的token，请运行 npm run login 获取token');
    }
    const isImageModel = model.includes('-image');
    const requestBody = generateRequestBody(messages, model, params, tools, token);
    if (isImageModel) {
      prepareImageRequest(requestBody);
    }
    //console.log(JSON.stringify(requestBody,null,2))
    
    const { id, created } = createResponseMeta();
    const maxRetries = Number(config.retryTimes || 0);
    const safeRetries = maxRetries > 0 ? Math.floor(maxRetries) : 0;
    
    if (stream) {
      setStreamHeaders(res);
      
      // 启动心跳，防止 Cloudflare 超时断连
      const heartbeatTimer = createHeartbeat(res);

      try {
        if (isImageModel) {
          const { content, usage } = await with429Retry(
            () => generateAssistantResponseNoStream(requestBody, token),
            safeRetries,
            'chat.stream.image '
          );
          writeStreamData(res, createStreamChunk(id, created, model, { content }));
          writeStreamData(res, { ...createStreamChunk(id, created, model, {}, 'stop'), usage });
        } else {
          let hasToolCall = false;
          let usageData = null;

          await with429Retry(
            () => generateAssistantResponse(requestBody, token, (data) => {
              if (data.type === 'usage') {
                usageData = data.usage;
              } else if (data.type === 'reasoning') {
                const delta = { reasoning_content: data.reasoning_content };
                writeStreamData(res, createStreamChunk(id, created, model, delta));
              } else if (data.type === 'tool_calls') {
                hasToolCall = true;
                const toolCallsWithIndex = data.tool_calls.map((toolCall, index) => ({ index, ...toolCall }));
                const delta = { tool_calls: toolCallsWithIndex };
                writeStreamData(res, createStreamChunk(id, created, model, delta));
              } else {
                const delta = { content: data.content };
                writeStreamData(res, createStreamChunk(id, created, model, delta));
              }
            }),
            safeRetries,
            'chat.stream '
          );

          writeStreamData(res, { ...createStreamChunk(id, created, model, {}, hasToolCall ? 'tool_calls' : 'stop'), usage: usageData });
        }

        clearInterval(heartbeatTimer);
        endStream(res);
      } catch (error) {
        clearInterval(heartbeatTimer);
        throw error;
      }
    } else {
      // 非流式请求：设置较长超时，避免大模型响应超时
      req.setTimeout(0); // 禁用请求超时
      res.setTimeout(0); // 禁用响应超时
      
      const { content, reasoningContent, toolCalls, usage } = await with429Retry(
        () => generateAssistantResponseNoStream(requestBody, token),
        safeRetries,
        'chat.no_stream '
      );
      // DeepSeek 格式：reasoning_content 在 content 之前
      const message = { role: 'assistant' };
      if (reasoningContent) message.reasoning_content = reasoningContent;
      message.content = content;
      if (toolCalls.length > 0) message.tool_calls = toolCalls;
      
      // 使用预构建的响应对象，减少内存分配
      const response = {
        id,
        object: 'chat.completion',
        created,
        model,
        choices: [{
          index: 0,
          message,
          finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
        }],
        usage
      };
      
      res.json(response);
    }
  } catch (error) {
    logger.error('生成响应失败:', error.message);
    // 如果已经开始写响应，就不再追加错误内容，避免协议冲突
    if (res.headersSent) {
      return;
    }

    // OpenAI 兼容错误返回：HTTP 状态码 + { error: { message, type, code } }
    const statusCode = Number(error.status) || 500;
    const errorPayload = buildOpenAIErrorPayload(error, statusCode);
    return res.status(statusCode).json(errorPayload);
  }
});

const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(`服务器已启动: ${config.server.host}:${config.server.port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`端口 ${config.server.port} 已被占用`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    logger.error(`端口 ${config.server.port} 无权限访问`);
    process.exit(1);
  } else {
    logger.error('服务器启动失败:', error.message);
    process.exit(1);
  }
});

const shutdown = () => {
  logger.info('正在关闭服务器...');
  
  // 停止内存管理器
  memoryManager.stop();
  logger.info('已停止内存管理器');
  
  // 关闭子进程请求器
  closeRequester();
  logger.info('已关闭子进程请求器');
  
  // 清理对象池
  chunkPool.length = 0;
  logger.info('已清理对象池');
  
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
  
  // 5秒超时强制退出
  setTimeout(() => {
    logger.warn('服务器关闭超时，强制退出');
    process.exit(0);
  }, 5000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获异常:', error.message);
  // 不立即退出，让当前请求完成
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});

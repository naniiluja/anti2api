/**
 * Claude format handler
 * Handles /v1/messages requests, supports streaming and non-streaming responses
 */

import { generateAssistantResponse, generateAssistantResponseNoStream } from '../../api/client.js';
import { generateClaudeRequestBody, prepareImageRequest } from '../../utils/utils.js';
import { normalizeClaudeParameters } from '../../utils/parameterNormalizer.js';
import { buildClaudeErrorPayload } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import config from '../../config/config.js';
import tokenManager from '../../auth/token_manager.js';
import requestLogger from '../../utils/requestLogger.js';
import {
  setStreamHeaders,
  createHeartbeat,
  with429Retry
} from '../stream.js';

/**
 * Create Claude stream event
 * @param {string} eventType - Event type
 * @param {Object} data - Event data
 * @returns {string}
 */
export const createClaudeStreamEvent = (eventType, data) => {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
};

/**
 * Create Claude non-streaming response
 * @param {string} id - Message ID
 * @param {string} model - Model name
 * @param {string|null} content - Text content
 * @param {string|null} reasoning - Chain of thought content
 * @param {string|null} reasoningSignature - Chain of thought signature
 * @param {Array|null} toolCalls - Tool calls
 * @param {string} stopReason - Stop reason
 * @param {Object|null} usage - Usage statistics
 * @returns {Object}
 */
export const createClaudeResponse = (id, model, content, reasoning, reasoningSignature, toolCalls, stopReason, usage) => {
  const contentBlocks = [];

  // Chain of thought content (if any) - Claude format uses thinking type
  if (reasoning) {
    const thinkingBlock = {
      type: "thinking",
      thinking: reasoning
    };
    if (reasoningSignature && config.passSignatureToClient) {
      thinkingBlock.signature = reasoningSignature;
    }
    contentBlocks.push(thinkingBlock);
  }

  // Text content
  if (content) {
    contentBlocks.push({
      type: "text",
      text: content
    });
  }

  // Tool calls
  if (toolCalls && toolCalls.length > 0) {
    for (const tc of toolCalls) {
      try {
        const toolBlock = {
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments)
        };
        if (tc.thoughtSignature && config.passSignatureToClient) {
          toolBlock.signature = tc.thoughtSignature;
        }
        contentBlocks.push(toolBlock);
      } catch (e) {
        // Parse failed, pass empty object
        contentBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: {}
        });
      }
    }
  }

  return {
    id: id,
    type: "message",
    role: "assistant",
    content: contentBlocks,
    model: model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: usage ? {
      input_tokens: usage.prompt_tokens || 0,
      output_tokens: usage.completion_tokens || 0
    } : { input_tokens: 0, output_tokens: 0 }
  };
};

/**
 * Handle Claude format chat request
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {boolean} isStream - Whether streaming response
 */
export const handleClaudeRequest = async (req, res, isStream) => {
  const { messages, model, system, tools, ...rawParams } = req.body;
  const startTime = Date.now();
  let tokenId = null;
  let usageData = null;

  try {
    if (!messages) {
      return res.status(400).json(buildClaudeErrorPayload({ message: 'messages is required' }, 400));
    }

    const token = await tokenManager.getToken();
    if (!token) {
      throw new Error('No available token. Please run npm run login to get a token');
    }
    tokenId = token.refresh_token?.substring(0, 8) || 'unknown';

    // Use unified parameter normalization module to handle Claude format parameters
    const parameters = normalizeClaudeParameters(rawParams);

    const isImageModel = model.includes('-image');
    const requestBody = generateClaudeRequestBody(messages, model, parameters, tools, system, token);

    if (isImageModel) {
      prepareImageRequest(requestBody);
    }

    const msgId = `msg_${Date.now()}`;
    const maxRetries = Number(config.retryTimes || 0);
    const safeRetries = maxRetries > 0 ? Math.floor(maxRetries) : 0;

    if (isStream) {
      setStreamHeaders(res);
      const heartbeatTimer = createHeartbeat(res);

      try {
        let contentIndex = 0;
        let usageData = null;
        let hasToolCall = false;
        let currentBlockType = null;
        let reasoningSent = false;

        // Send message_start
        res.write(createClaudeStreamEvent('message_start', {
          type: "message_start",
          message: {
            id: msgId,
            type: "message",
            role: "assistant",
            content: [],
            model: model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        }));

        if (isImageModel) {
          // Image model: get result non-streaming then return in streaming format
          const { content, usage } = await with429Retry(
            () => generateAssistantResponseNoStream(requestBody, token),
            safeRetries,
            'claude.stream.image '
          );

          // Send text block
          res.write(createClaudeStreamEvent('content_block_start', {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" }
          }));
          res.write(createClaudeStreamEvent('content_block_delta', {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: content || '' }
          }));
          res.write(createClaudeStreamEvent('content_block_stop', {
            type: "content_block_stop",
            index: 0
          }));

          // Send message_delta and message_stop
          res.write(createClaudeStreamEvent('message_delta', {
            type: "message_delta",
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: usage ? { output_tokens: usage.completion_tokens || 0 } : { output_tokens: 0 }
          }));
          res.write(createClaudeStreamEvent('message_stop', {
            type: "message_stop"
          }));

          clearInterval(heartbeatTimer);
          res.end();
          return;
        }

        await with429Retry(
          () => generateAssistantResponse(requestBody, token, (data) => {
            if (data.type === 'usage') {
              usageData = data.usage;
            } else if (data.type === 'reasoning') {
              // Chain of thought content - use thinking type
              if (!reasoningSent) {
                // Start thinking block
                const contentBlock = { type: "thinking", thinking: "" };
                if (data.thoughtSignature && config.passSignatureToClient) {
                  contentBlock.signature = data.thoughtSignature;
                }
                res.write(createClaudeStreamEvent('content_block_start', {
                  type: "content_block_start",
                  index: contentIndex,
                  content_block: contentBlock
                }));
                currentBlockType = 'thinking';
                reasoningSent = true;
              }
              // Send thinking delta
              const delta = { type: "thinking_delta", thinking: data.reasoning_content || '' };
              if (data.thoughtSignature && config.passSignatureToClient) {
                delta.signature = data.thoughtSignature;
              }
              res.write(createClaudeStreamEvent('content_block_delta', {
                type: "content_block_delta",
                index: contentIndex,
                delta: delta
              }));
            } else if (data.type === 'tool_calls') {
              hasToolCall = true;
              // End previous block (if any)
              if (currentBlockType) {
                res.write(createClaudeStreamEvent('content_block_stop', {
                  type: "content_block_stop",
                  index: contentIndex
                }));
                contentIndex++;
              }
              // Tool calls
              for (const tc of data.tool_calls) {
                try {
                  const inputObj = JSON.parse(tc.function.arguments);
                  const toolContentBlock = { type: "tool_use", id: tc.id, name: tc.function.name, input: {} };
                  if (tc.thoughtSignature && config.passSignatureToClient) {
                    toolContentBlock.signature = tc.thoughtSignature;
                  }
                  res.write(createClaudeStreamEvent('content_block_start', {
                    type: "content_block_start",
                    index: contentIndex,
                    content_block: toolContentBlock
                  }));
                  // Send input delta
                  res.write(createClaudeStreamEvent('content_block_delta', {
                    type: "content_block_delta",
                    index: contentIndex,
                    delta: { type: "input_json_delta", partial_json: JSON.stringify(inputObj) }
                  }));
                  res.write(createClaudeStreamEvent('content_block_stop', {
                    type: "content_block_stop",
                    index: contentIndex
                  }));
                  contentIndex++;
                } catch (e) {
                  // Parse failed, skip
                }
              }
              currentBlockType = null;
            } else {
              // Normal text content
              if (currentBlockType === 'thinking') {
                // End thinking block
                res.write(createClaudeStreamEvent('content_block_stop', {
                  type: "content_block_stop",
                  index: contentIndex
                }));
                contentIndex++;
                currentBlockType = null;
              }
              if (currentBlockType !== 'text') {
                // Start text block
                res.write(createClaudeStreamEvent('content_block_start', {
                  type: "content_block_start",
                  index: contentIndex,
                  content_block: { type: "text", text: "" }
                }));
                currentBlockType = 'text';
              }
              // Send text delta
              res.write(createClaudeStreamEvent('content_block_delta', {
                type: "content_block_delta",
                index: contentIndex,
                delta: { type: "text_delta", text: data.content || '' }
              }));
            }
          }),
          safeRetries,
          'claude.stream '
        );

        // End last content block
        if (currentBlockType) {
          res.write(createClaudeStreamEvent('content_block_stop', {
            type: "content_block_stop",
            index: contentIndex
          }));
        }

        // Send message_delta
        const stopReason = hasToolCall ? 'tool_use' : 'end_turn';
        res.write(createClaudeStreamEvent('message_delta', {
          type: "message_delta",
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: usageData ? { output_tokens: usageData.completion_tokens || 0 } : { output_tokens: 0 }
        }));

        // Send message_stop
        res.write(createClaudeStreamEvent('message_stop', {
          type: "message_stop"
        }));

        clearInterval(heartbeatTimer);
        res.end();

        // Log success for streaming
        requestLogger.logRequest({
          model,
          tokenId,
          status: 'success',
          statusCode: 200,
          duration: Date.now() - startTime,
          inputTokens: usageData?.prompt_tokens || 0,
          outputTokens: usageData?.completion_tokens || 0,
          isStream: true
        });
      } catch (error) {
        clearInterval(heartbeatTimer);
        if (!res.writableEnded) {
          const statusCode = error.statusCode || error.status || 500;
          res.write(createClaudeStreamEvent('error', buildClaudeErrorPayload(error, statusCode)));
          res.end();
        }
        logger.error('Claude stream request failed:', error.message);
        return;
      }
    } else {
      // Non-streaming request
      req.setTimeout(0);
      res.setTimeout(0);

      const { content, reasoningContent, reasoningSignature, toolCalls, usage } = await with429Retry(
        () => generateAssistantResponseNoStream(requestBody, token),
        safeRetries,
        'claude.no_stream '
      );

      const stopReason = toolCalls.length > 0 ? 'tool_use' : 'end_turn';
      const response = createClaudeResponse(
        msgId,
        model,
        content,
        reasoningContent,
        reasoningSignature,
        toolCalls,
        stopReason,
        usage
      );

      res.json(response);

      // Log success for non-streaming
      requestLogger.logRequest({
        model,
        tokenId,
        status: 'success',
        statusCode: 200,
        duration: Date.now() - startTime,
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        isStream: false
      });
    }
  } catch (error) {
    logger.error('Claude request failed:', error.message);
    const statusCode = error.statusCode || error.status || 500;

    // Log error
    requestLogger.logRequest({
      model,
      tokenId,
      status: 'error',
      statusCode,
      duration: Date.now() - startTime,
      inputTokens: 0,
      outputTokens: 0,
      errorMessage: error.message,
      isStream
    });

    if (res.headersSent) return;
    res.status(statusCode).json(buildClaudeErrorPayload(error, statusCode));
  }
};
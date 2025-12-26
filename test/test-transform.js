import { generateRequestBody } from './utils.js';

// Test scenario: user -> assistant -> assistant(tool calls, no content) -> tool1 result -> tool2 result
const testMessages = [
  {
    role: "user",
    content: "Help me check the weather and news"
  },
  {
    role: "assistant",
    content: "Okay, I'll help you check."
  },
  {
    role: "assistant",
    content: "",
    tool_calls: [
      {
        id: "call_001",
        type: "function",
        function: {
          name: "get_weather",
          arguments: JSON.stringify({ city: "Beijing" })
        }
      },
      {
        id: "call_002",
        type: "function",
        function: {
          name: "get_news",
          arguments: JSON.stringify({ category: "Technology" })
        }
      }
    ]
  },
  {
    role: "tool",
    tool_call_id: "call_001",
    content: "Beijing today is sunny, temperature 25 degrees"
  },
  {
    role: "tool",
    tool_call_id: "call_002",
    content: "Latest tech news: AI technology breakthrough"
  }
];

const testTools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get weather information",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_news",
      description: "Get news",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" }
        }
      }
    }
  }
];

console.log("=== Testing Message Transform ===\n");
console.log("Input OpenAI format messages:");
console.log(JSON.stringify(testMessages, null, 2));

const result = generateRequestBody(testMessages, "claude-sonnet-4-5", {}, testTools);

console.log("\n=== Transformed Antigravity Format ===\n");
console.log(JSON.stringify(result.request.contents, null, 2));

console.log("\n=== Verification Results ===");
const contents = result.request.contents;
console.log(`✓ Message count: ${contents.length}`);
console.log(`✓ Message 1 (user): ${contents[0]?.role === 'user' ? '✓' : '✗'}`);
console.log(`✓ Message 2 (model): ${contents[1]?.role === 'model' ? '✓' : '✗'}`);
console.log(`✓ Message 3 (model+tools): ${contents[2]?.role === 'model' && contents[2]?.parts?.length === 2 ? '✓' : '✗'}`);
console.log(`✓ Message 4 (tool1 response): ${contents[3]?.role === 'user' && contents[3]?.parts[0]?.functionResponse ? '✓' : '✗'}`);
console.log(`✓ Message 5 (tool2 response): ${contents[4]?.role === 'user' && contents[4]?.parts[0]?.functionResponse ? '✓' : '✗'}`);

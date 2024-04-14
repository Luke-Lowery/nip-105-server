
const OFFERING_KIND = 31_402;

const GPT_SCHEMA = {
    "type": "object",
    "properties": {
        "model": {
            "type": "string",
            "enum": ["gpt-3.5-turbo"]
        },
        "messages": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "role": {
                        "type": "string",
                        "enum": ["system", "user"]
                    },
                    "content": {
                        "type": "string"
                    }
                },
                "required": ["role", "content"]
            },
            "minItems": 1
        }
    },
    "required": ["model", "messages"]
}

const GPT_RESULT_SCHEMA = {
    "type": "object",
    "required": ["id", "object", "created", "model", "choices", "usage"],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^chatcmpl-[a-zA-Z0-9-]+$"
      },
      "object": {
        "type": "string",
        "enum": ["chat.completion"]
      },
      "created": {
        "type": "integer"
      },
      "model": {
        "type": "string"
      },
      "choices": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["index", "message"],
          "properties": {
            "index": {
              "type": "integer"
            },
            "message": {
              "type": "object",
              "required": ["role", "content"],
              "properties": {
                "role": {
                  "type": "string",
                  "enum": ["assistant"]
                },
                "content": {
                  "type": "string"
                }
              }
            },
            "finish_reason": {
              "type": "string",
              "enum": ["stop"]
            }
          }
        }
      },
      "usage": {
        "type": "object",
        "required": ["prompt_tokens", "completion_tokens", "total_tokens"],
        "properties": {
          "prompt_tokens": {
            "type": "integer"
          },
          "completion_tokens": {
            "type": "integer"
          },
          "total_tokens": {
            "type": "integer"
          }
        }
      }
    }
  }



module.exports = { GPT_SCHEMA, GPT_RESULT_SCHEMA, OFFERING_KIND };
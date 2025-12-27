// AI服务对象 - 增强版
const AIService = {
    // 发送消息到AI API
    sendMessage: async function(messages, systemPrompt, memories = []) {
        const config = StorageService.getApiConfig();
        
        if (!config.apiKey) {
            return {
                role: 'assistant',
                content: '【系统提示】请先在设置面板中配置您的 API Key。'
            };
        }
        
        // 构建完整的消息列表
        const completeMessages = [
            { role: 'system', content: systemPrompt },
            // 添加全局记忆
            ...memories.filter(m => m.isGlobal).map(memory => ({ 
                role: 'system', 
                content: `记忆记录: ${memory.content}` 
            })),
            // 添加会话级记忆
            ...memories.filter(m => !m.isGlobal).map(memory => ({ 
                role: 'system', 
                content: `背景记忆: ${memory.content}` 
            })),
            ...messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        ];
        
        try {
            let responseContent;
            
            // 根据提供商调用不同的处理函数
            if (config.provider === 'openai' || config.provider === 'other') {
                responseContent = await this._callOpenAI(completeMessages, config);
            } else if (config.provider === 'anthropic') {
                responseContent = await this._callAnthropic(completeMessages, config);
            } else if (config.provider === 'gemini') {
                responseContent = await this._callGemini(completeMessages, config);
            } else if (config.provider === 'azure') {
                responseContent = await this._callOpenAI(completeMessages, config);
            }
            
            return {
                role: 'assistant',
                content: responseContent
            };
            
        } catch (error) {
            console.error('AI API 详细错误信息:', error);
            return {
                role: 'assistant',
                content: `【连接失败】\n原因：${error.message}\n\n提示：请检查您的 API Endpoint 地址和网络环境。如果是国内使用，请确保使用了正确的代理地址。`
            };
        }
    },
    
    // OpenAI 及 兼容接口调用
    _callOpenAI: async function(messages, config) {
        let endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
        
        // 自动补全路径：如果只填了域名，没填路径，自动补上
        if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
        if (!endpoint.endsWith('/v1/chat/completions') && !endpoint.includes('/completions')) {
            endpoint += '/v1/chat/completions';
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: 0.7
                })
            });

            // --- 核心改进：检查返回内容是不是网页 ---
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                if (errorText.includes("<!doctype") || errorText.includes("<html")) {
                    throw new Error(`API 地址填写错误或被网络拦截。服务器返回的是一个 HTML 网页而非数据。请检查 Endpoint 是否包含 /v1/chat/completions`);
                }
                throw new Error(`服务器返回了非 JSON 内容: ${errorText.substring(0, 50)}...`);
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error?.message || `服务器返回错误代码: ${response.status}`);
            }
            
            return data.choices[0].message.content;

        } catch (err) {
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                throw new Error("网络请求被拒绝。可能是 API 地址无法访问、跨域限制或需要开启代理。");
            }
            throw err;
        }
    },

    // Anthropic (Claude) 调用
    _callAnthropic: async function(messages, config) {
        const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
        const systemMessage = messages.find(m => m.role === 'system')?.content || "";
        const userMessages = messages.filter(m => m.role !== 'system');

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: config.model || 'claude-3-haiku-20240307',
                system: systemMessage,
                messages: userMessages,
                max_tokens: 2048
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Anthropic API 调用失败");
        return data.content[0].text;
    },

    // Google Gemini 调用
    _callGemini: async function(messages, config) {
        const model = config.model || 'gemini-pro';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
        
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Gemini API 调用失败");
        return data.candidates[0].content.parts[0].text;
    },

    // 生成记忆摘要
    generateMemorySummary: async function(messages) {
        const config = StorageService.getApiConfig();
        if (!config.apiKey) return null;
        
        const recentMessages = messages.slice(-10);
        const prompt = [
            { 
                role: 'system', 
                content: '请总结以上对话中关于用户的关键事实、偏好或重要背景信息。字数要求：简练，100字以内。' 
            },
            ...recentMessages
        ];
        
        try {
            return await this._callOpenAI(prompt, config);
        } catch (error) {
            console.error('自动生成记忆失败:', error);
            return null;
        }
    },
    
    // 测试API连接
    testConnection: async function() {
        const config = StorageService.getApiConfig();
        if (!config.apiKey) return { success: false, message: '未填写 API Key' };
        
        try {
            const result = await this._callOpenAI([
                { role: 'user', content: 'hi' }
            ], config);
            
            return {
                success: true,
                message: '连接成功！API 响应正常。',
                response: result
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
};

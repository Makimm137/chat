// AI服务对象 - 最终修复版
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
        
        const completeMessages = [
            { role: 'system', content: systemPrompt },
            ...memories.filter(m => m.isGlobal).map(memory => ({ 
                role: 'system', 
                content: `记忆记录: ${memory.content}` 
            })),
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
            
            // 模式选择逻辑
            if (config.provider === 'openai' || config.provider === 'other') {
                // 大多数中转服务都应该走这个模式（OpenAI 兼容模式）
                responseContent = await this._callOpenAI(completeMessages, config);
            } else if (config.provider === 'gemini') {
                // 只有直连 Google 官方且网络允许时才选这个
                responseContent = await this._callGemini(completeMessages, config);
            } else if (config.provider === 'anthropic') {
                responseContent = await this._callAnthropic(completeMessages, config);
            } else if (config.provider === 'azure') {
                responseContent = await this._callAzure(completeMessages, config);
            } else {
                responseContent = await this._callOpenAI(completeMessages, config);
            }
            
            return {
                role: 'assistant',
                content: responseContent
            };
            
        } catch (error) {
            console.error('AI API 详细错误:', error);
            return {
                role: 'assistant',
                content: `【连接失败】\n原因：${error.message}\n\n可能的解决方案：\n1. 检查中转API地址是否正确\n2. 尝试启用一个浏览器插件来解决CORS问题，如"Allow CORS"插件\n3. 确保API Key格式正确并且有效\n4. 如果您在中国，可能需要使用代理才能访问某些服务\n5. 如使用中转服务，请确认中转服务商是否支持从浏览器直接访问`
            };
        }
    },
    
    // OpenAI 及 中转商兼容接口
    _callOpenAI: async function(messages, config) {
        let endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
        
        // 智能处理地址：如果用户填写的地址不含请求路径，则自动补全
        if (!endpoint.includes('/chat/completions') && !endpoint.includes('/completions')) {
            // 移除末尾的斜杠
            if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            endpoint += '/v1/chat/completions';
        }

        // 在控制台打印最终请求的地址，方便调试
        console.log("正在请求地址 (OpenAI模式):", endpoint);
        console.log("使用模型:", config.model || 'gpt-3.5-turbo');
        
        try {
            // 使用no-cors模式尝试解决某些CORS问题
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2000 // 增加最大token以获取更长回复
                })
            });

            // 检查内容类型
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                console.error("服务器返回非JSON数据:", errorText);
                throw new Error(`服务器没有返回JSON数据。可能是地址错误或服务器配置问题。服务器返回内容: ${errorText.substring(0, 100)}...`);
            }

            const data = await response.json();
            console.log("API响应数据:", data);
            
            if (!response.ok) {
                const errorMessage = data.error?.message || `API返回错误状态码: ${response.status}`;
                console.error("API返回错误:", errorMessage);
                throw new Error(errorMessage);
            }
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error("API返回数据格式不正确:", data);
                throw new Error("API返回的数据格式不符合预期，请检查中转服务是否正确配置");
            }
            
            return data.choices[0].message.content;

        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
                console.error("网络请求失败:", err);
                throw new Error("网络请求被拒绝。可能是API地址无法访问、跨域限制或需要开启代理。如果使用中转服务，请联系中转服务提供商，确认其API支持从浏览器直接访问。");
            }
            throw err;
        }
    },

    // Azure OpenAI 接口
    _callAzure: async function(messages, config) {
        if (!config.endpoint) {
            throw new Error("使用Azure OpenAI需要提供完整的端点URL");
        }
        
        let endpoint = config.endpoint;
        // 确保端点包含必要的部分
        if (!endpoint.includes('/deployments/') && !endpoint.includes('/completions')) {
            throw new Error("Azure端点格式不正确，应包含部署名称，例如：https://{resource}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions?api-version=2023-05-15");
        }

        console.log("正在请求Azure地址:", endpoint);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': config.apiKey
                },
                body: JSON.stringify({
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || `Azure API返回错误: ${response.status}`);
            }
            
            return data.choices[0].message.content;
        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
                throw new Error("无法连接到Azure OpenAI服务。请检查网络连接或端点URL是否正确。");
            }
            throw err;
        }
    },

    // Google Gemini 官方格式调用
    _callGemini: async function(messages, config) {
        const model = config.model || 'gemini-pro';
        // Gemini 官方格式 Key 是在 URL 里的
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
        
        console.log("正在请求地址 (Gemini模式):", endpoint);

        // 转换消息格式为Gemini格式
        const formattedMessages = [];
        let currentRole = null;
        let currentParts = [];
        
        for (const msg of messages) {
            const role = msg.role === 'assistant' ? 'model' : 'user';
            
            // 如果是系统消息，添加到用户消息中
            if (msg.role === 'system') {
                if (formattedMessages.length === 0) {
                    // 如果是第一条系统消息，创建一个用户消息
                    currentRole = 'user';
                    currentParts.push({ text: msg.content });
                } else {
                    // 否则添加到最近的用户消息中
                    const lastMsg = formattedMessages[formattedMessages.length - 1];
                    if (lastMsg.role === 'user') {
                        lastMsg.parts.push({ text: '\n[System: ' + msg.content + ']' });
                    } else {
                        formattedMessages.push({
                            role: 'user',
                            parts: [{ text: '[System: ' + msg.content + ']' }]
                        });
                    }
                }
                continue;
            }
            
            // 如果角色变化，创建新的消息对象
            if (role !== currentRole) {
                if (currentRole !== null && currentParts.length > 0) {
                    formattedMessages.push({
                        role: currentRole,
                        parts: [...currentParts]
                    });
                }
                currentRole = role;
                currentParts = [{ text: msg.content }];
            } else {
                // 同一角色的连续消息，添加到parts
                currentParts.push({ text: '\n' + msg.content });
            }
        }
        
        // 添加最后一组消息
        if (currentRole !== null && currentParts.length > 0) {
            formattedMessages.push({
                role: currentRole,
                parts: currentParts
            });
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: formattedMessages })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Gemini API返回错误");
            }
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error("Gemini API返回空结果");
            }
            
            return data.candidates[0].content.parts[0].text;
        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
                throw new Error("无法连接到Google Gemini API。如果您在中国，请使用OpenAI兼容的中转服务，并将Provider选为'Other'。");
            }
            throw err;
        }
    },

    // Anthropic Claude API调用
    _callAnthropic: async function(messages, config) {
        const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
        console.log("正在请求地址 (Anthropic Claude模式):", endpoint);
        
        // 将消息转换为Anthropic格式
        const systemMessages = messages.filter(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');
        
        // 合并系统消息
        let systemPrompt = "";
        if (systemMessages.length > 0) {
            systemPrompt = systemMessages.map(m => m.content).join("\n\n");
        }
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: config.model || 'claude-3-opus-20240229',
                    system: systemPrompt,
                    messages: conversationMessages,
                    max_tokens: 4000
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || `Claude API返回错误: ${response.status}`);
            }
            
            return data.content[0].text;
        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
                throw new Error("无法连接到Anthropic Claude API。请检查网络连接或考虑使用中转服务。");
            }
            throw err;
        }
    },

    // 生成记忆摘要
    generateMemorySummary: async function(messages) {
        const config = StorageService.getApiConfig();
        if (!config.apiKey) return null;
        
        const promptMessages = [
            { 
                role: 'system', 
                content: '请总结以下对话中的关键信息，形成一段简短的记忆摘要(50-100字)。这个摘要将作为AI的记忆使用。' 
            },
            ...messages.slice(-10)
        ];
        
        try {
            let result;
            if (config.provider === 'openai' || config.provider === 'other') {
                result = await this._callOpenAI(promptMessages, config);
            } else if (config.provider === 'gemini') {
                result = await this._callGemini(promptMessages, config);
            } else if (config.provider === 'anthropic') {
                result = await this._callAnthropic(promptMessages, config);
            } else if (config.provider === 'azure') {
                result = await this._callAzure(promptMessages, config);
            } else {
                result = await this._callOpenAI(promptMessages, config);
            }
            return result;
        } catch (e) {
            console.error('生成记忆摘要失败:', e);
            return null;
        }
    },
    
    // 测试连接
    testConnection: async function() {
        const config = StorageService.getApiConfig();
        if (!config.apiKey) {
            return { 
                success: false, 
                message: '请先填写API密钥' 
            };
        }
        
        try {
            let testResult;
            const testMessages = [{ role: 'user', content: 'Hello' }];
            
            console.log("正在测试连接...", config.provider);
            
            if (config.provider === 'openai' || config.provider === 'other') {
                testResult = await this._callOpenAI(testMessages, config);
            } else if (config.provider === 'gemini') {
                testResult = await this._callGemini(testMessages, config);
            } else if (config.provider === 'anthropic') {
                testResult = await this._callAnthropic(testMessages, config);
            } else if (config.provider === 'azure') {
                testResult = await this._callAzure(testMessages, config);
            } else {
                testResult = await this._callOpenAI(testMessages, config);
            }
            
            return { 
                success: true, 
                message: '连接成功!', 
                response: testResult 
            };
        } catch (error) {
            console.error("测试连接失败:", error);
            return { 
                success: false, 
                message: error.message 
            };
        }
    }
};

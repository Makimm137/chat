// AI服务对象
const AIService = {
    // 发送消息到AI API
    sendMessage: async function(messages, systemPrompt, memories = []) {
        const config = StorageService.getApiConfig();
        
        // 如果没有API密钥，返回错误
        if (!config.apiKey) {
            return {
                role: 'assistant',
                content: 'Please set your API key in the settings panel.'
            };
        }
        
        // 构建完整的消息列表，包括系统提示和记忆
        const completeMessages = [
            { role: 'system', content: systemPrompt },
            // 添加全局记忆
            ...memories.filter(m => m.isGlobal).map(memory => ({ 
                role: 'system', 
                content: `Memory: ${memory.content}` 
            })),
            // 添加会话级记忆
            ...memories.filter(m => !m.isGlobal).map(memory => ({ 
                role: 'system', 
                content: `Memory: ${memory.content}` 
            })),
            ...messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        ];
        
        try {
            let response;
            
            // OpenAI API调用
            if (config.provider === 'openai') {
                response = await this._callOpenAI(completeMessages, config);
            } 
            // 这里可以添加其他AI提供商的API调用
            else if (config.provider === 'anthropic') {
                response = await this._callAnthropic(completeMessages, config);
            }
            else if (config.provider === 'gemini') {
                response = await this._callGemini(completeMessages, config);
            }
            else {
                // 默认尝试OpenAI兼容接口
                response = await this._callOpenAI(completeMessages, config);
            }
            
            return {
                role: 'assistant',
                content: response
            };
            
        } catch (error) {
            console.error('AI API error:', error);
            return {
                role: 'assistant',
                content: `Error: ${error.message || 'Failed to get response from AI service'}`
            };
        }
    },
    
    // OpenAI API调用
    _callOpenAI: async function(messages, config) {
        const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2048
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    },
    
    // Anthropic (Claude) API调用
    _callAnthropic: async function(messages, config) {
        // 简化实现，实际应用中需要根据Anthropic的API格式调整
        const systemMessage = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
        
        // 构建Anthropic格式的消息
        let anthropicMessages = [];
        for (let i = 0; i < userMessages.length; i++) {
            const msg = userMessages[i];
            if (msg.role === 'user') {
                anthropicMessages.push({ role: 'user', content: msg.content });
            } else {
                anthropicMessages.push({ role: 'assistant', content: msg.content });
            }
        }
        
        const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: config.model || 'claude-2',
                system: systemMessage?.content || '',
                messages: anthropicMessages,
                max_tokens: 2048
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.content[0].text;
    },
    
    // Google Gemini API调用
    _callGemini: async function(messages, config) {
        // 简化实现，需要根据Gemini的实际API调整
        const endpoint = config.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-pro'}:generateContent`;
        
        // 转换消息格式为Gemini格式
        const geminiContent = {
            contents: []
        };
        
        let currentRole = null;
        let currentParts = [];
        
        for (const message of messages) {
            if (message.role !== currentRole) {
                if (currentRole) {
                    geminiContent.contents.push({
                        role: currentRole === 'system' || currentRole === 'assistant' ? 'MODEL' : 'USER',
                        parts: currentParts
                    });
                }
                currentRole = message.role;
                currentParts = [{ text: message.content }];
            } else {
                currentParts.push({ text: message.content });
            }
        }
        
        // 添加最后一组消息
        if (currentRole) {
            geminiContent.contents.push({
                role: currentRole === 'system' || currentRole === 'assistant' ? 'MODEL' : 'USER',
                parts: currentParts
            });
        }
        
        const response = await fetch(`${endpoint}?key=${config.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: geminiContent.contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    },
    
    // 生成记忆摘要
    generateMemorySummary: async function(messages) {
        const config = StorageService.getApiConfig();
        
        if (!config.apiKey) {
            return "Failed to generate memory: API key not set.";
        }
        
        // 只使用最近的10条消息
        const recentMessages = messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
        }));
        
        const summaryPrompt = [
            { 
                role: 'system', 
                content: 'Create a concise, factual summary of the key information from this conversation. Focus on important facts, preferences, or decisions that would be useful to remember for future conversations. Keep it under 100 words.' 
            },
            ...recentMessages
        ];
        
        try {
            let response;
            
            if (config.provider === 'openai') {
                response = await this._callOpenAI(summaryPrompt, {
                    ...config,
                    model: 'gpt-3.5-turbo' // 使用固定的经济模型生成摘要
                });
            } else {
                // 默认使用OpenAI兼容接口
                response = await this._callOpenAI(summaryPrompt, {
                    ...config,
                    model: 'gpt-3.5-turbo'
                });
            }
            
            return response;
        } catch (error) {
            console.error('Memory generation error:', error);
            return null;
        }
    },
    
    // 测试API连接
    testConnection: async function() {
        const config = StorageService.getApiConfig();
        
        if (!config.apiKey) {
            return {
                success: false,
                message: 'API key is not set.'
            };
        }
        
        try {
            const testMessages = [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Hello, this is a test message. Please respond with "API connection successful!"' }
            ];
            
            let response;
            
            if (config.provider === 'openai') {
                response = await this._callOpenAI(testMessages, config);
            } else if (config.provider === 'anthropic') {
                response = await this._callAnthropic(testMessages, config);
            } else if (config.provider === 'gemini') {
                response = await this._callGemini(testMessages, config);
            } else {
                response = await this._callOpenAI(testMessages, config);
            }
            
            return {
                success: true,
                message: 'Connection successful!',
                response: response
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`
            };
        }
    }
};


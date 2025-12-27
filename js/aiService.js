// AI服务对象 - 最终完整修正版
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
                content: `【连接失败】\n原因：${error.message}\n\n建议排查：\n1. 中转商地址是否填写正确？\n2. 您的中转商是否支持“跨域(CORS)”访问？\n3. 确认 API Key 是否属于您选的那个 Provider。`
            };
        }
    },
    
    // OpenAI 及 中转商兼容接口
    _callOpenAI: async function(messages, config) {
        let endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
        
        // 智能处理地址：如果用户填写的地址不含请求路径，则自动补全
        if (!endpoint.includes('/chat/completions') && !endpoint.includes('/completions')) {
            if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            endpoint += '/v1/chat/completions';
        }

        // 在控制台打印最终请求的地址，方便你调试
        console.log("正在请求地址 (OpenAI模式):", endpoint);

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

            // 检查内容类型
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                throw new Error(`服务器没有返回数据包。可能是地址填错了。返回内容前50字：${errorText.substring(0, 50)}`);
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || `服务器返回报错代码: ${response.status}`);
            }
            
            return data.choices[0].message.content;

        } catch (err) {
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                throw new Error("网络连接被浏览器阻止。原因可能是：1.中转商地址不支持跨域。2.地址不可达(需要梯子)。3.地址写错了导致DNS解析失败。");
            }
            throw err;
        }
    },

    // Google Gemini 官方格式调用
    _callGemini: async function(messages, config) {
        const model = config.model || 'gemini-pro';
        // 注意：Gemini 官方格式 Key 是在 URL 里的
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
        
        console.log("正在请求地址 (Gemini模式):", endpoint);

        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || "Gemini 官方接口报错");
            return data.candidates[0].content.parts[0].text;
        } catch (err) {
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                throw new Error("无法直连 Google 官方接口。如果您在使用中转，请将 Provider 选为 'Others' 并填写中转商给您的 OpenAI 格式地址。");
            }
            throw err;
        }
    },

    // 其余函数保持逻辑不变
    _callAnthropic: async function(messages, config) {
        // ... (此处省略，保持与之前一致)
        const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: config.model,
                messages: messages.filter(m => m.role !== 'system'),
                max_tokens: 2048
            })
        });
        const data = await response.json();
        return data.content[0].text;
    },

    generateMemorySummary: async function(messages) {
        const config = StorageService.getApiConfig();
        if (!config.apiKey) return null;
        try {
            return await this._callOpenAI([{ role: 'system', content: '请总结这段对话的关键信息。' }, ...messages.slice(-10)], config);
        } catch (e) { return null; }
    },
    
    testConnection: async function() {
        const config = StorageService.getApiConfig();
        if (!config.apiKey) return { success: false, message: '未填写 API Key' };
        try {
            const result = await this._callOpenAI([{ role: 'user', content: 'hi' }], config);
            return { success: true, message: '连接成功！', response: result };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

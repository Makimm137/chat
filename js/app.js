// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 主应用对象
const App = {
    currentConversation: null,
    isLoading: false,
    
    // 初始化应用
    init: function() {
        this._loadInitialData();
        this._setupEventListeners();
    },
    
    // 加载初始数据
    _loadInitialData: function() {
        // 加载角色信息
        const character = StorageService.getCharacter();
        UIComponents.updateCharacterUI(character);
        
        // 加载API设置
        const apiConfig = StorageService.getApiConfig();
        UIComponents.updateApiSettingsUI(apiConfig);
        
        // 加载会话列表
        const conversations = StorageService.getConversations();
        const currentId = StorageService.getCurrentConversationId();
        UIComponents.renderConversations(conversations, currentId);
        
        // 加载当前会话
        if (currentId) {
            this.loadConversation(currentId);
        } else if (conversations.length > 0) {
            this.loadConversation(conversations[0].id);
        }
    },
    
    // 设置事件监听器
    _setupEventListeners: function() {
        // 新建会话按钮
        document.getElementById('new-conversation-btn').addEventListener('click', () => {
            this.createNewConversation();
        });
        
        // 发送消息按钮
        document.getElementById('send-message-btn').addEventListener('click', () => {
            this.sendMessage();
        });
        
        // 消息输入框按Enter发送
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
            
            // 自动调整高度
            UIComponents.updateTextareaHeight(e.target);
        });
        
        // 消息输入框内容变化调整高度
        document.getElementById('message-input').addEventListener('input', (e) => {
            UIComponents.updateTextareaHeight(e.target);
            
            // 启用/禁用发送按钮
            document.getElementById('send-message-btn').disabled = !e.target.value.trim();
        });
        
        // 搜索会话
        document.getElementById('search-conversations').addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            const conversations = StorageService.searchConversations(searchTerm);
            UIComponents.renderConversations(conversations, this.currentConversation?.id);
        });
        
        // 设置按钮
        document.getElementById('settings-btn').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.add('active');
        });
        
        // 关闭设置按钮
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.remove('active');
        });
        
        // 设置选项卡切换
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', function() {
                // 移除所有选项卡的active类
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelectorAll('.settings-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                // 添加active类到当前选项卡
                this.classList.add('active');
                const tabId = this.dataset.tab;
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
        
        // 保存角色设置
        document.getElementById('save-character-btn').addEventListener('click', () => {
            this.saveCharacterSettings();
        });
        
        // 保存API设置
        document.getElementById('save-api-btn').addEventListener('click', () => {
            this.saveApiSettings();
        });
        
        // 测试API连接
        document.getElementById('test-api-btn').addEventListener('click', async () => {
            this.testApiConnection();
        });
        
        // 头像URL输入框变化
        document.getElementById('character-avatar').addEventListener('input', (e) => {
            document.querySelector('#avatar-preview img').src = e.target.value || 'https://via.placeholder.com/100';
        });
        
        // API提供商切换
        document.getElementById('api-provider').addEventListener('change', (e) => {
            const endpointGroup = document.querySelector('.api-endpoint-group');
            if (e.target.value === 'azure' || e.target.value === 'other') {
                endpointGroup.style.display = 'block';
            } else {
                endpointGroup.style.display = 'none';
            }
        });
        
        // 生成记忆按钮
        document.getElementById('generate-memory-btn').addEventListener('click', () => {
            this.generateMemory();
        });
        
        // 添加记忆按钮
        document.getElementById('add-memory-btn').addEventListener('click', () => {
            this.addNewMemory();
        });
        
        // 导出数据按钮
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });
        
        // 导入数据按钮
        document.getElementById('import-data-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        
        // 导入文件选择
        document.getElementById('import-file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
            }
        });
    },
    
    // 创建新会话
    createNewConversation: function() {
        const id = generateId();
        const newConversation = {
            id: id,
            title: 'New Conversation',
            messages: [],
            memories: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        // 保存并加载新会话
        StorageService.saveConversation(newConversation);
        StorageService.setCurrentConversationId(id);
        this.currentConversation = newConversation;
        
        // 更新UI
        const conversations = StorageService.getConversations();
        UIComponents.renderConversations(conversations, id);
        UIComponents.renderMessages([], StorageService.getCharacter());
        
        // 更新会话标题
        document.getElementById('current-conversation-title').textContent = 'New Conversation';
        
        // 清空输入框
        document.getElementById('message-input').value = '';
        document.getElementById('send-message-btn').disabled = true;
        
        // 更新记忆面板
        UIComponents.renderMemories([]);
        
        // 聚焦输入框
        document.getElementById('message-input').focus();
    },
    
    // 加载会话
    loadConversation: function(id) {
        const conversation = StorageService.getConversation(id);
        if (!conversation) return;
        
        this.currentConversation = conversation;
        StorageService.setCurrentConversationId(id);
        
        // 更新UI
        const character = StorageService.getCharacter();
        UIComponents.renderMessages(conversation.messages, character);
        UIComponents.renderConversations(StorageService.getConversations(), id);
        
        // 更新会话标题
        document.getElementById('current-conversation-title').textContent = conversation.title || 'Conversation';
        
        // 更新记忆面板
        const allMemories = [...character.memories, ...conversation.memories];
        UIComponents.renderMemories(allMemories);
        
        // 聚焦输入框
        document.getElementById('message-input').focus();
    },
    
    // 删除会话
    deleteConversation: function(id) {
        const conversations = StorageService.deleteConversation(id);
        
        // 如果有剩余会话，加载第一个
        if (conversations.length > 0) {
            this.loadConversation(conversations[0].id);
        } else {
            // 否则创建新会话
            this.createNewConversation();
        }
    },
    
    // 发送消息
    sendMessage: async function() {
        const inputElement = document.getElementById('message-input');
        const messageText = inputElement.value.trim();
        
        // 检查是否有内容可发送
        if (!messageText || this.isLoading) return;
        
        // 如果没有当前会话，创建一个新的
        if (!this.currentConversation) {
            this.createNewConversation();
        }
        
        // 构建用户消息对象
        const userMessage = {
            id: generateId(),
            role: 'user',
            content: messageText,
            timestamp: Date.now()
        };
        
        // 清空并重置输入框
        inputElement.value = '';
        inputElement.style.height = 'auto';
        document.getElementById('send-message-btn').disabled = true;
        
        // 更新会话
        const updatedMessages = [...this.currentConversation.messages, userMessage];
        this.currentConversation.messages = updatedMessages;
        this.currentConversation.updatedAt = Date.now();
        
        // 更新第一条消息作为会话标题
        if (updatedMessages.length === 1) {
            this.currentConversation.title = messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '');
            document.getElementById('current-conversation-title').textContent = this.currentConversation.title;
        }
        
        // 保存会话
        StorageService.saveConversation(this.currentConversation);
        
        // 更新UI
        const character = StorageService.getCharacter();
        UIComponents.renderMessages(updatedMessages, character);
        UIComponents.renderConversations(StorageService.getConversations(), this.currentConversation.id);
        
        // 显示加载中指示器
        this.isLoading = true;
        UIComponents.addLoadingIndicator(character);
        
        try {
            // 准备发送给AI的记忆列表
            const memories = [
                ...character.memories, // 全局记忆
                ...this.currentConversation.memories // 会话级记忆
            ];
            
            // 构建完整的系统提示
            const systemPrompt = `${character.systemPrompt}\n\n${character.rules}`;
            
            // 调用AI服务
            const aiResponse = await AIService.sendMessage(
                this.currentConversation.messages, 
                systemPrompt, 
                memories
            );
            
            // 构建AI消息对象
            const aiMessage = {
                id: generateId(),
                role: 'assistant',
                content: aiResponse.content,
                timestamp: Date.now()
            };
            
            // 更新会话
            this.currentConversation.messages.push(aiMessage);
            this.currentConversation.updatedAt = Date.now();
            StorageService.saveConversation(this.currentConversation);
            
            // 更新UI
            UIComponents.renderMessages(this.currentConversation.messages, character);
            
            // 每隔10条消息自动生成一次记忆
            if (this.currentConversation.messages.length % 10 === 0 && this.currentConversation.messages.length >= 10) {
                this.generateMemory();
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            
            // 添加错误消息
            const errorMessage = {
                id: generateId(),
                role: 'system',
                content: `Error: ${error.message || 'Failed to get AI response'}`,
                timestamp: Date.now()
            };
            
            this.currentConversation.messages.push(errorMessage);
            StorageService.saveConversation(this.currentConversation);
            
            // 更新UI
            UIComponents.renderMessages(this.currentConversation.messages, character);
            
            // 显示错误通知
            UIComponents.showNotification('Failed to get AI response. Check console for details.', 'error');
            
        } finally {
            // 移除加载中指示器
            UIComponents.removeLoadingIndicator();
            this.isLoading = false;
        }
    },
    
    // 生成记忆
    generateMemory: async function() {
        if (!this.currentConversation || this.currentConversation.messages.length < 2) {
            UIComponents.showNotification('Not enough messages to generate memory.', 'error');
            return;
        }
        
        // 添加系统消息，表示正在生成记忆
        const processingMessage = {
            id: generateId(),
            role: 'system',
            content: 'Generating memory from recent conversation...',
            timestamp: Date.now()
        };
        
        this.currentConversation.messages.push(processingMessage);
        StorageService.saveConversation(this.currentConversation);
        
        // 更新UI
        const character = StorageService.getCharacter();
        UIComponents.renderMessages(this.currentConversation.messages, character);
        
        try {
            // 生成记忆摘要
            const memorySummary = await AIService.generateMemorySummary(this.currentConversation.messages);
            
            if (memorySummary) {
                // 创建新的记忆对象
                const newMemory = {
                    id: generateId(),
                    content: memorySummary,
                    createdAt: Date.now(),
                    isGlobal: false
                };
                
                // 将记忆添加到当前会话
                this.currentConversation.memories.push(newMemory);
                
                // 更新系统消息
                const lastMessage = this.currentConversation.messages[this.currentConversation.messages.length - 1];
                if (lastMessage.role === 'system' && lastMessage.content.includes('Generating memory')) {
                    lastMessage.content = `Memory created: "${memorySummary}"`;
                    lastMessage.timestamp = Date.now();
                }
                
                // 保存会话
                StorageService.saveConversation(this.currentConversation);
                
                // 更新UI
                UIComponents.renderMessages(this.currentConversation.messages, character);
                
                // 更新记忆面板
                const allMemories = [...character.memories, ...this.currentConversation.memories];
                UIComponents.renderMemories(allMemories);
                
                UIComponents.showNotification('Memory generated successfully.');
            } else {
                throw new Error('Failed to generate memory summary');
            }
            
        } catch (error) {
            console.error('Memory generation error:', error);
            
            // 更新错误消息
            const lastMessage = this.currentConversation.messages[this.currentConversation.messages.length - 1];
            if (lastMessage.role === 'system' && lastMessage.content.includes('Generating memory')) {
                lastMessage.content = `Memory generation failed: ${error.message}`;
                lastMessage.timestamp = Date.now();
            }
            
            // 保存会话
            StorageService.saveConversation(this.currentConversation);
            
            // 更新UI
            UIComponents.renderMessages(this.currentConversation.messages, character);
            
            UIComponents.showNotification('Failed to generate memory.', 'error');
        }
    },
    
    // 添加新的记忆
    addNewMemory: function() {
        const memoryContent = document.getElementById('new-memory').value.trim();
        const isGlobal = document.getElementById('memory-is-global').checked;
        
        if (!memoryContent) {
            UIComponents.showNotification('Please enter memory content.', 'error');
            return;
        }
        
        // 创建新的记忆对象
        const newMemory = {
            id: generateId(),
            content: memoryContent,
            createdAt: Date.now(),
            isGlobal: isGlobal
        };
        
        // 添加记忆到全局或当前会话
        if (isGlobal) {
            const character = StorageService.getCharacter();
            character.memories.push(newMemory);
            StorageService.saveCharacter(character);
        } else {
            if (!this.currentConversation) {
                UIComponents.showNotification('Please select or create a conversation first.', 'error');
                return;
            }
            
            this.currentConversation.memories.push(newMemory);
            StorageService.saveConversation(this.currentConversation);
        }
        
        // 清空输入框
        document.getElementById('new-memory').value = '';
        document.getElementById('memory-is-global').checked = false;
        
        // 更新UI
        const character = StorageService.getCharacter();
        const allMemories = this.currentConversation
            ? [...character.memories, ...this.currentConversation.memories]
            : character.memories;
        
        UIComponents.renderMemories(allMemories);
        UIComponents.showNotification('Memory added successfully.');
        
        // 添加系统消息到当前会话
        if (this.currentConversation) {
            const systemMessage = {
                id: generateId(),
                role: 'system',
                content: `New ${isGlobal ? 'global' : 'conversation'} memory added: "${memoryContent}"`,
                timestamp: Date.now()
            };
            
            this.currentConversation.messages.push(systemMessage);
            StorageService.saveConversation(this.currentConversation);
            
            // 更新消息UI
            UIComponents.renderMessages(this.currentConversation.messages, character);
        }
    },
    
    // 删除记忆
    deleteMemory: function(id) {
        // 检查是否在全局记忆中
        const character = StorageService.getCharacter();
        const globalIndex = character.memories.findIndex(m => m.id === id);
        
        if (globalIndex !== -1) {
            // 从全局记忆中删除
            character.memories.splice(globalIndex, 1);
            StorageService.saveCharacter(character);
        } else if (this.currentConversation) {
            // 检查是否在当前会话的记忆中
            const conversationIndex = this.currentConversation.memories.findIndex(m => m.id === id);
            
            if (conversationIndex !== -1) {
                // 从当前会话记忆中删除
                this.currentConversation.memories.splice(conversationIndex, 1);
                StorageService.saveConversation(this.currentConversation);
                
                // 添加系统消息
                const systemMessage = {
                    id: generateId(),
                    role: 'system',
                    content: 'A memory was deleted from this conversation.',
                    timestamp: Date.now()
                };
                
                this.currentConversation.messages.push(systemMessage);
                StorageService.saveConversation(this.currentConversation);
                
                // 更新消息UI
                UIComponents.renderMessages(this.currentConversation.messages, character);
            }
        }
        
        // 更新记忆面板
        const allMemories = this.currentConversation
            ? [...character.memories, ...this.currentConversation.memories]
            : character.memories;
        
        UIComponents.renderMemories(allMemories);
        UIComponents.showNotification('Memory deleted successfully.');
    },
    
    // 编辑记忆
    editMemory: function(id) {
        // 检查是否在全局记忆中
        const character = StorageService.getCharacter();
        const globalMemory = character.memories.find(m => m.id === id);
        
        let memory;
        let isGlobal = false;
        
        if (globalMemory) {
            memory = globalMemory;
            isGlobal = true;
        } else if (this.currentConversation) {
            // 检查是否在当前会话的记忆中
            memory = this.currentConversation.memories.find(m => m.id === id);
        }
        
        if (memory) {
            // 填充编辑表单
            document.getElementById('new-memory').value = memory.content;
            document.getElementById('memory-is-global').checked = isGlobal;
            
            // 滚动到编辑表单
            document.getElementById('new-memory').scrollIntoView({ behavior: 'smooth' });
            document.getElementById('new-memory').focus();
            
            // 删除原记忆
            this.deleteMemory(id);
            
            UIComponents.showNotification('Edit the memory and click "Add Memory" to save changes.');
        }
    },
    
    // 保存角色设置
    saveCharacterSettings: function() {
        const character = StorageService.getCharacter();
        
        // 更新角色信息
        character.name = document.getElementById('character-name').value.trim() || 'AI Assistant';
        character.avatar = document.getElementById('character-avatar').value.trim() || 'https://via.placeholder.com/150';
        character.systemPrompt = document.getElementById('system-prompt').value.trim() || 'You are a helpful AI assistant.';
        character.rules = document.getElementById('character-rules').value.trim() || 'Be concise and friendly.';
        
        // 保存角色信息
        StorageService.saveCharacter(character);
        
        // 更新UI
        UIComponents.updateCharacterUI(character);
        
        // 如果有当前会话，重新渲染消息
        if (this.currentConversation) {
            UIComponents.renderMessages(this.currentConversation.messages, character);
        }
        
        UIComponents.showNotification('Character settings saved successfully.');
    },
    
    // 保存API设置
    saveApiSettings: function() {
        const apiConfig = StorageService.getApiConfig();
        
        // 更新API配置
        apiConfig.provider = document.getElementById('api-provider').value;
        apiConfig.apiKey = document.getElementById('api-key').value.trim();
        apiConfig.model = document.getElementById('api-model').value.trim() || 'gpt-3.5-turbo';
        
        // 检查是否需要设置endpoint
        if (apiConfig.provider === 'azure' || apiConfig.provider === 'other') {
            apiConfig.endpoint = document.getElementById('api-endpoint').value.trim();
        } else {
            apiConfig.endpoint = '';
        }
        
        // 保存API配置
        StorageService.saveApiConfig(apiConfig);
        
        UIComponents.showNotification('API settings saved successfully.');
    },
    
    // 测试API连接
    testApiConnection: async function() {
        // 先保存设置
        this.saveApiSettings();
        
        UIComponents.showNotification('Testing API connection...');
        
        try {
            const result = await AIService.testConnection();
            
            if (result.success) {
                UIComponents.showNotification('Connection successful!');
            } else {
                UIComponents.showNotification(`Connection failed: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('API test error:', error);
            UIComponents.showNotification(`Connection test error: ${error.message}`, 'error');
        }
    },
    
    // 导出数据
    exportData: function() {
        const data = StorageService.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 创建临时下载链接
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        UIComponents.showNotification('Data exported successfully.');
    },
    
    // 导入数据
    importData: function(file) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const success = StorageService.importData(data);
                
                if (success) {
                    // 重新加载数据
                    this._loadInitialData();
                    UIComponents.showNotification('Data imported successfully.');
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                console.error('Import error:', error);
                UIComponents.showNotification(`Import failed: ${error.message}`, 'error');
            }
        };
        
        reader.readAsText(file);
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});


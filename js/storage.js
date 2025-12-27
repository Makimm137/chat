// 存储键名常量
const STORAGE_KEYS = {
    CHARACTER: 'aiCharacter',
    CONVERSATIONS: 'conversations',
    CURRENT_CONVERSATION: 'currentConversationId',
    API_CONFIG: 'apiConfig'
};

// 默认角色设置
const DEFAULT_CHARACTER = {
    name: 'AI Assistant',
    avatar: 'https://via.placeholder.com/150',
    systemPrompt: 'You are a helpful AI assistant.',
    rules: 'Be concise and friendly. Answer questions truthfully.',
    memories: []  // 全局记忆
};

// 默认API设置
const DEFAULT_API_CONFIG = {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    endpoint: ''
};

// 存储服务对象
const StorageService = {
    // 获取角色信息
    getCharacter: function() {
        const stored = localStorage.getItem(STORAGE_KEYS.CHARACTER);
        return stored ? JSON.parse(stored) : DEFAULT_CHARACTER;
    },
    
    // 保存角色信息
    saveCharacter: function(character) {
        localStorage.setItem(STORAGE_KEYS.CHARACTER, JSON.stringify(character));
    },
    
    // 获取所有会话
    getConversations: function() {
        const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
        return stored ? JSON.parse(stored) : [];
    },
    
    // 保存所有会话
    saveConversations: function(conversations) {
        localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    },
    
    // 获取单个会话
    getConversation: function(id) {
        const conversations = this.getConversations();
        return conversations.find(conv => conv.id === id) || null;
    },
    
    // 保存单个会话
    saveConversation: function(conversation) {
        const conversations = this.getConversations();
        const index = conversations.findIndex(conv => conv.id === conversation.id);
        
        if (index !== -1) {
            conversations[index] = conversation;
        } else {
            conversations.push(conversation);
        }
        
        this.saveConversations(conversations);
    },
    
    // 删除会话
    deleteConversation: function(id) {
        const conversations = this.getConversations();
        const filtered = conversations.filter(conv => conv.id !== id);
        this.saveConversations(filtered);
        
        // 如果删除的是当前会话，需要更新当前会话ID
        if (this.getCurrentConversationId() === id) {
            this.setCurrentConversationId(filtered.length > 0 ? filtered[0].id : null);
        }
        
        return filtered;
    },
    
    // 获取当前会话ID
    getCurrentConversationId: function() {
        return localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION);
    },
    
    // 设置当前会话ID
    setCurrentConversationId: function(id) {
        if (id) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION, id);
        } else {
            localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION);
        }
    },
    
    // 获取API配置
    getApiConfig: function() {
        const stored = localStorage.getItem(STORAGE_KEYS.API_CONFIG);
        return stored ? JSON.parse(stored) : DEFAULT_API_CONFIG;
    },
    
    // 保存API配置
    saveApiConfig: function(config) {
        localStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(config));
    },
    
    // 导出所有数据
    exportData: function() {
        return {
            character: this.getCharacter(),
            conversations: this.getConversations(),
            apiConfig: this.getApiConfig()
        };
    },
    
    // 导入所有数据
    importData: function(data) {
        if (!data) return false;
        
        try {
            if (data.character) this.saveCharacter(data.character);
            if (data.conversations) this.saveConversations(data.conversations);
            if (data.apiConfig) this.saveApiConfig(data.apiConfig);
            
            // 设置当前会话ID
            if (data.conversations && data.conversations.length > 0) {
                this.setCurrentConversationId(data.conversations[0].id);
            }
            
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    },
    
    // 搜索会话
    searchConversations: function(searchTerm) {
        if (!searchTerm) return this.getConversations();
        
        const conversations = this.getConversations();
        const lowerSearch = searchTerm.toLowerCase();
        
        return conversations.filter(conv => {
            // 搜索标题
            if (conv.title.toLowerCase().includes(lowerSearch)) {
                return true;
            }
            
            // 搜索消息内容
            return conv.messages.some(msg => 
                msg.content.toLowerCase().includes(lowerSearch)
            );
        });
    }
};


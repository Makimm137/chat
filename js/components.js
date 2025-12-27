// UI组件对象
const UIComponents = {
    // 渲染会话列表
    renderConversations: function(conversations, currentId) {
        const listElement = document.getElementById('conversations-list');
        listElement.innerHTML = '';
        
        if (conversations.length === 0) {
            listElement.innerHTML = '<div class="empty-conversations">No conversations yet</div>';
            return;
        }
        
        conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = `conversation-item ${conv.id === currentId ? 'active' : ''}`;
            item.dataset.id = conv.id;
            
            const lastMessage = conv.messages.length > 0 
                ? conv.messages[conv.messages.length - 1].content 
                : 'New conversation';
            
            const preview = lastMessage.length > 50 
                ? lastMessage.substring(0, 50) + '...' 
                : lastMessage;
            
            item.innerHTML = `
                <div class="conversation-title">${conv.title || 'New Conversation'}</div>
                <div class="conversation-preview">${preview}</div>
                <button class="delete-conversation" data-id="${conv.id}">&times;</button>
            `;
            
            listElement.appendChild(item);
        });
        
        // 添加事件监听器
        this._addConversationEventListeners();
    },
    
    // 为会话列表添加事件监听器
    _addConversationEventListeners: function() {
        // 点击会话切换
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', function(event) {
                if (!event.target.classList.contains('delete-conversation')) {
                    const id = this.dataset.id;
                    App.loadConversation(id);
                }
            });
        });
        
        // 删除会话
        document.querySelectorAll('.delete-conversation').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                const id = this.dataset.id;
                if (confirm('Are you sure you want to delete this conversation?')) {
                    App.deleteConversation(id);
                }
            });
        });
    },
    
    // 渲染聊天消息
    renderMessages: function(messages, character) {
        const container = document.getElementById('messages-container');
        const emptyChat = document.getElementById('empty-chat');
        
        // 保存滚动位置
        const wasAtBottom = this._isScrolledToBottom(container);
        
        if (messages.length === 0) {
            emptyChat.style.display = 'flex';
        } else {
            emptyChat.style.display = 'none';
            
            // 清空容器但保留空聊天提示
            container.innerHTML = '';
            
            // 渲染消息
            messages.forEach(message => {
                const messageElement = this._createMessageElement(message, character);
                container.appendChild(messageElement);
            });
            
            // 如果之前在底部，滚动到新底部
            if (wasAtBottom) {
                this._scrollToBottom(container);
            }
        }
    },
    
    // 创建单条消息元素
    _createMessageElement: function(message, character) {
        const messageDiv = document.createElement('div');
        
        if (message.role === 'user') {
            messageDiv.className = 'message user-message';
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    <div class="message-content">${this._formatMessage(message.content)}</div>
                    <div class="message-timestamp">${this._formatTimestamp(message.timestamp)}</div>
                </div>
                <div class="message-avatar">
                    <div class="user-avatar">You</div>
                </div>
            `;
        } else if (message.role === 'assistant') {
            messageDiv.className = 'message ai-message';
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <img src="${character.avatar}" alt="${character.name}">
                </div>
                <div class="message-bubble">
                    <div class="message-content">${this._formatMessage(message.content)}</div>
                    <div class="message-timestamp">${this._formatTimestamp(message.timestamp)}</div>
                </div>
            `;
        } else if (message.role === 'system') {
            messageDiv.className = 'message system-message';
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    <div class="message-content">${message.content}</div>
                    <div class="message-timestamp">${this._formatTimestamp(message.timestamp)}</div>
                </div>
            `;
        }
        
        return messageDiv;
    },
    
    // 添加加载中指示器
    addLoadingIndicator: function(character) {
        const container = document.getElementById('messages-container');
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message';
        loadingDiv.id = 'loading-message';
        
        loadingDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${character.avatar}" alt="${character.name}">
            </div>
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        container.appendChild(loadingDiv);
        this._scrollToBottom(container);
    },
    
    // 移除加载中指示器
    removeLoadingIndicator: function() {
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }
    },
    
    // 渲染记忆列表
    renderMemories: function(memories) {
        const container = document.getElementById('memories-list');
        
        if (memories.length === 0) {
            container.innerHTML = '<div class="empty-memories">No memories yet</div>';
            return;
        }
        
        container.innerHTML = '';
        
        memories.forEach(memory => {
            const memoryDiv = document.createElement('div');
            memoryDiv.className = 'memory-item';
            memoryDiv.dataset.id = memory.id;
            
            memoryDiv.innerHTML = `
                <div class="memory-content">${memory.content}</div>
                <div class="memory-tag">${memory.isGlobal ? 'Global Memory' : 'Conversation Memory'}</div>
                <div class="memory-actions">
                    <button class="edit-memory" data-id="${memory.id}"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-memory" data-id="${memory.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            container.appendChild(memoryDiv);
        });
        
        // 添加事件监听器
        this._addMemoryEventListeners();
    },
    
    // 为记忆列表添加事件监听器
    _addMemoryEventListeners: function() {
        // 编辑记忆
        document.querySelectorAll('.edit-memory').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.dataset.id;
                App.editMemory(id);
            });
        });
        
        // 删除记忆
        document.querySelectorAll('.delete-memory').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.dataset.id;
                if (confirm('Are you sure you want to delete this memory?')) {
                    App.deleteMemory(id);
                }
            });
        });
    },
    
    // 格式化时间戳
    _formatTimestamp: function(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', { 
            hour: 'numeric', 
            minute: 'numeric',
            hour12: true,
            month: 'short',
            day: 'numeric'
        });
    },
    
    // 格式化消息内容（处理换行和代码块）
    _formatMessage: function(content) {
        if (!content) return '';
        
        // 替换换行符为<br>
        let formatted = content.replace(/\n/g, '<br>');
        
        // 处理代码块 ()
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // 处理行内代码 (`code`)
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        return formatted;
    },
    
    // 检查是否滚动到底部
    _isScrolledToBottom: function(element) {
        return element.scrollHeight - element.scrollTop <= element.clientHeight + 100;
    },
    
    // 滚动到底部
    _scrollToBottom: function(element) {
        element.scrollTop = element.scrollHeight;
    },
    
    // 更新消息输入框自适应高度
    updateTextareaHeight: function(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    },
    
    // 更新角色信息UI
    updateCharacterUI: function(character) {
        // 更新侧边栏头像和名称
        document.getElementById('character-avatar-sidebar').src = character.avatar;
        document.getElementById('character-name-sidebar').textContent = character.name;
        
        // 更新设置面板
        document.getElementById('character-name').value = character.name;
        document.getElementById('character-avatar').value = character.avatar;
        document.getElementById('system-prompt').value = character.systemPrompt;
        document.getElementById('character-rules').value = character.rules;
        
        // 更新头像预览
        document.querySelector('#avatar-preview img').src = character.avatar;
    },
    
    // 更新API设置UI
    updateApiSettingsUI: function(apiConfig) {
        document.getElementById('api-provider').value = apiConfig.provider;
        document.getElementById('api-key').value = apiConfig.apiKey;
        document.getElementById('api-model').value = apiConfig.model;
        
        // 更新endpoint输入框显示状态
        const endpointGroup = document.querySelector('.api-endpoint-group');
        if (apiConfig.provider === 'azure' || apiConfig.provider === 'other') {
            endpointGroup.style.display = 'block';
            document.getElementById('api-endpoint').value = apiConfig.endpoint || '';
        } else {
            endpointGroup.style.display = 'none';
        }
    },
    
    // 显示通知
    showNotification: function(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 检查是否已存在通知容器
        let notifContainer = document.querySelector('.notification-container');
        if (!notifContainer) {
            notifContainer = document.createElement('div');
            notifContainer.className = 'notification-container';
            document.body.appendChild(notifContainer);
        }
        
        // 添加通知到容器
        notifContainer.appendChild(notification);
        
        // 添加样式
        notification.style.backgroundColor = type === 'error' ? '#ff4d4f' : '#52c41a';
        notification.style.color = 'white';
        notification.style.padding = '10px 16px';
        notification.style.borderRadius = '4px';
        notification.style.marginBottom = '10px';
        notification.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            notification.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                notification.remove();
                
                // 如果容器为空，移除容器
                if (notifContainer.children.length === 0) {
                    notifContainer.remove();
                }
            }, 300);
        }, 3000);
    }
};


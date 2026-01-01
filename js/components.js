// UI组件对象
const UIComponents = {
    // 防抖函数
    _debounce: function(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    
    // 渲染会话列表
    renderConversations: function(conversations, currentId) {
        const listElement = document.getElementById('conversations-list');
        listElement.innerHTML = '';
        
        if (conversations.length === 0) {
            listElement.innerHTML = '<div class="empty-conversations">没有会话记录</div>';
            return;
        }
        
        // 获取AI角色信息
        const character = StorageService.getCharacter();
        
        conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = `conversation-item ${conv.id === currentId ? 'active' : ''}`;
            item.dataset.id = conv.id;
            
            const lastMessage = conv.messages.length > 0 
                ? conv.messages[conv.messages.length - 1].content 
                : '开始新对话';
            
            const preview = lastMessage.length > 40 
                ? lastMessage.substring(0, 40) + '...' 
                : lastMessage;
            
            item.innerHTML = `
                <div class="conversation-avatar">
                    <img src="${character.avatar}" alt="${character.name}">
                </div>
                <div class="conversation-info">
                    <div class="conversation-title">${conv.title || '新对话'}</div>
                    <div class="conversation-preview">${preview}</div>
                </div>
                <div class="conversation-actions">
                    <button class="delete-conversation" data-id="${conv.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
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
                if (!event.target.classList.contains('delete-conversation') && 
                    !event.target.closest('.delete-conversation')) {
                    const id = this.dataset.id;
                    App.loadConversation(id);
                    
                    // 移动端自动关闭侧边栏
                    if (window.innerWidth <= 768) {
                        document.getElementById('sidebar').classList.remove('active');
                    }
                }
            });
        });
        
        // 删除会话
        document.querySelectorAll('.delete-conversation').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                const id = this.dataset.id;
                if (confirm('确定要删除这个会话吗？')) {
                    App.deleteConversation(id);
                }
            });
        });
    },
    
    // 渲染聊天消息
    renderMessages: function(messages, character) {
        const container = document.getElementById('messages-container');
        let emptyChat = document.getElementById('empty-chat');
        
        // 保存滚动位置
        const wasAtBottom = this._isScrolledToBottom(container);
        
        // 使用文档碎片减少DOM操作
        const fragment = document.createDocumentFragment();
        
        if (!messages || messages.length === 0) {
            // 如果empty-chat元素不存在，则创建一个
            if (!emptyChat) {
                emptyChat = document.createElement('div');
                emptyChat.id = 'empty-chat';
                emptyChat.className = 'empty-chat';
                emptyChat.innerHTML = '<div class="empty-chat-content">开始新对话吧!</div>';
            }
            
            emptyChat.style.display = 'flex';
            container.innerHTML = '';
            container.appendChild(emptyChat);
            return;
        }
        
        // 如果找到empty-chat元素，设置为不显示
        if (emptyChat) {
            emptyChat.style.display = 'none';
        }
        
        container.innerHTML = '';
        
        // 获取用户设置
        const userSettings = StorageService.getUserSettings();
        
        // 按时间排序消息
        const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
        
        // 一次性渲染消息，减少重排重绘
        sortedMessages.forEach((message, index) => {
            let messageElement;
            
            if (message.role === 'user') {
                messageElement = this._createUserMessageElement(message, userSettings);
            } else if (message.role === 'assistant') {
                messageElement = this._createAIMessageElement(message, character);
            } else if (message.role === 'system') {
                messageElement = this._createSystemMessageElement(message);
            }
            
            if (messageElement) {
                fragment.appendChild(messageElement);
            }
        });
        
        // 一次性添加所有消息到DOM
        container.appendChild(fragment);
        
        // 如果之前在底部，滚动到新底部
        if (wasAtBottom) {
            // 使用requestAnimationFrame确保在渲染后滚动
            requestAnimationFrame(() => {
                this._scrollToBottom(container);
            });
        }
    },
    
    // 创建用户消息元素
    _createUserMessageElement: function(message, userSettings) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.dataset.id = message.id;
        
        const formattedTime = this._formatTimestamp(message.timestamp);
        
        // 使用用户头像或首字母
        const userAvatar = userSettings.avatar || 'https://via.placeholder.com/32';
        const userName = userSettings.name || '我';
        const userInitial = userName.charAt(0).toUpperCase();
        
        messageDiv.innerHTML = `
            <div class="message-group">
                <div class="message-bubble">
                    <div class="message-content">${this._formatMessage(message.content)}</div>
                    <div class="message-reactions">
                        ${this._renderReactions(message.reactions)}
                    </div>
                </div>
                <div class="message-info">
                    ${formattedTime}
                    <span class="read-status">${message.isRead ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>'}</span>
                </div>
                <div class="reaction-toolbar">
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="👍">👍</button>
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="❤️">❤️</button>
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="😂">😂</button>
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="😮">😮</button>
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="😢">😢</button>
                    <button class="reaction-btn more-reactions" data-id="${message.id}">+</button>
                </div>
            </div>
            <div class="message-avatar">
                ${userAvatar.startsWith('data:') || userAvatar.startsWith('http') 
                    ? `<img src="${userAvatar}" alt="${userName}">` 
                    : `<div class="user-avatar-container">${userInitial}</div>`}
            </div>
        `;
        
        // 添加事件监听器
        this._addReactionListeners(messageDiv);
        
        return messageDiv;
    },
    
    // 创建AI消息元素
    _createAIMessageElement: function(message, character) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.dataset.id = message.id;
        
        const formattedTime = this._formatTimestamp(message.timestamp);
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${character.avatar}" alt="${character.name}">
            </div>
            <div class="message-group">
                <div class="message-bubble">
                    <div class="message-content">${this._formatMessage(message.content)}</div>
                    <div class="message-reactions">
                        ${this._renderReactions(message.reactions)}
                    </div>
                </div>
                <div class="message-info">${formattedTime}</div>
                <div class="reaction-toolbar">
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="👍">👍</button>
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="❤️">❤️</button>
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="😂">😂</button>
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="😮">😮</button>
                    <button class="reaction-btn" data-id="${message.id}" data-emoji="😢">😢</button>
                    <button class="reaction-btn more-reactions" data-id="${message.id}">+</button>
                </div>
            </div>
        `;
        
        // 添加事件监听器
        this._addReactionListeners(messageDiv);
        
        return messageDiv;
    },
    
    // 创建系统消息元素
    _createSystemMessageElement: function(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">${message.content}</div>
                <div class="message-info">${this._formatTimestamp(message.timestamp)}</div>
            </div>
        `;
        
        return messageDiv;
    },
    
    // 渲染消息反应
    _renderReactions: function(reactions) {
        if (!reactions || Object.keys(reactions).length === 0) {
            return '';
        }
        
        let html = '<div class="reactions-container">';
        
        for (const [emoji, count] of Object.entries(reactions)) {
            if (count > 0) {
                html += `<div class="reaction" data-emoji="${emoji}">${emoji} ${count}</div>`;
            }
        }
        
        html += '</div>';
        return html;
    },
    
    // 为反应按钮添加事件监听器
    _addReactionListeners: function(messageElement) {
        // 常规表情反应按钮
        messageElement.querySelectorAll('.reaction-btn:not(.more-reactions)').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = button.dataset.id;
                const emoji = button.dataset.emoji;
                App.toggleReaction(messageId, emoji);
            });
        });
        
        // 更多表情按钮
        messageElement.querySelector('.more-reactions')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const messageId = e.target.dataset.id;
            this._showEmojiPicker(messageId, e.target);
        });
        
        // 点击已有表情
        messageElement.querySelectorAll('.reaction').forEach(reaction => {
            reaction.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = messageElement.dataset.id;
                const emoji = reaction.dataset.emoji;
                App.toggleReaction(messageId, emoji);
            });
        });
    },
    
    // 显示表情选择器
    _showEmojiPicker: function(messageId, targetElement) {
        // 检查是否已存在表情选择器
        let picker = document.querySelector('.emoji-picker');
        if (picker) {
            picker.remove();
        }
        
        // 创建表情选择器
        picker = document.createElement('div');
        picker.className = 'emoji-picker';
        picker.dataset.messageId = messageId;
        
        // 常用表情
        const commonEmojis = ['😀', '😊', '🤣', '😍', '🥰', '😘', '😎', '🤔', '😮', '😢', 
                             '😡', '👍', '👎', '❤️', '🔥', '🎉', '🙏', '👏', '🤝', '💯'];
        
        let emojiHtml = '';
        commonEmojis.forEach(emoji => {
            emojiHtml += `<span class="emoji-option" data-emoji="${emoji}">${emoji}</span>`;
        });
        
        picker.innerHTML = emojiHtml;
        
        // 定位表情选择器
        document.body.appendChild(picker);
        const rect = targetElement.getBoundingClientRect();
        picker.style.top = `${rect.top - picker.offsetHeight}px`;
        picker.style.left = `${rect.left}px`;
        
        // 添加事件监听器
        picker.querySelectorAll('.emoji-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const emoji = e.target.dataset.emoji;
                App.toggleReaction(messageId, emoji);
                picker.remove();
            });
        });
        
        // 点击其他地方关闭选择器
        document.addEventListener('click', function closePicker(e) {
            if (!picker.contains(e.target) && e.target !== targetElement) {
                picker.remove();
                document.removeEventListener('click', closePicker);
            }
        });
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
            <div class="message-group">
                <div class="message-bubble">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
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
        
        if (!memories || memories.length === 0) {
            container.innerHTML = '<div class="empty-memories">暂无记忆</div>';
            return;
        }
        
        // 使用文档碎片
        const fragment = document.createDocumentFragment();
        
        memories.forEach(memory => {
            const memoryDiv = document.createElement('div');
            memoryDiv.className = 'memory-item';
            memoryDiv.dataset.id = memory.id;
            
            memoryDiv.innerHTML = `
                <div class="memory-content">${memory.content}</div>
                <div class="memory-tag ${memory.isGlobal ? 'global' : ''}">${memory.isGlobal ? '全局记忆' : '会话记忆'}</div>
                <div class="memory-actions">
                    <button class="edit-memory" data-id="${memory.id}"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-memory" data-id="${memory.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            fragment.appendChild(memoryDiv);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
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
                if (confirm('确定要删除这条记忆吗？')) {
                    App.deleteMemory(id);
                }
            });
        });
    },
    
    // 格式化时间戳
    _formatTimestamp: function(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        
        // 如果是今天的消息，只显示时间
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
        }
        
        // 如果是昨天的消息
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return `昨天 ${date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}`;
        }
        
        // 如果是今年的消息
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString('zh-CN', {month: '2-digit', day: '2-digit'}) + 
                   ' ' + date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
        }
        
        // 其他情况显示完整日期
        return date.toLocaleDateString('zh-CN') + ' ' + 
               date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
    },
    
        // 格式化消息内容（增强版：支持粗体、斜体、代码块等）
        _formatMessage: function(content) {
            if (!content) return '';
        
            // 1. 先保护代码块，防止里面的星号被错误解析（可选增强，这里直接处理简单标签）
            let formatted = content;
        
            // 2. 处理代码块 (```code```)
            formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
            // 3. 处理行内代码 (`code`)
            formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
            // 4. 处理粗体 (**bold**)
            formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
            // 5. 处理斜体 (*italic*)
            formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            // 6. 处理下划线 (__underline__)
            formatted = formatted.replace(/__(.*?)__/g, '<u>$1</u>');
        
            // 7. 处理换行符（注意：放在加粗斜体后面，防止干扰）
            formatted = formatted.replace(/\n/g, '<br>');
        
            // 8. 简单表情符号转换
            formatted = formatted.replace(/😊/g, '😊')
                .replace(/😄/g, '😄')
                .replace(/❤️/g, '❤️')
                .replace(/👍/g, '👍');
        
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
        // 更新聊天区域头像和名称
        document.getElementById('ai-avatar-header').src = character.avatar || 'https://via.placeholder.com/40';
        document.getElementById('current-conversation-title').textContent = character.name || 'AI助手';
        
        // 更新设置面板
        document.getElementById('character-name').value = character.name || '';
        document.getElementById('character-avatar').value = character.avatar || '';
        document.getElementById('character-description').value = character.description || '';
        document.getElementById('speech-style').value = character.speechStyle || '';
        document.getElementById('character-rules').value = character.rules || '';
        document.getElementById('character-knowledge').value = character.knowledge || '';
        
        // 更新头像预览
        document.querySelector('#ai-avatar-preview img').src = character.avatar || 'https://via.placeholder.com/100';
        
        // 更新性格标签
        // 首先清除所有已选择的标签
        document.querySelectorAll('#personality-tags .tag').forEach(tag => {
            tag.classList.remove('selected');
        });
        
        // 清空已选标签容器
        const selectedTagsContainer = document.getElementById('selected-personality-tags');
        selectedTagsContainer.innerHTML = '';
        
        // 添加保存的标签
        if (character.personalityTags && character.personalityTags.length > 0) {
            character.personalityTags.forEach(tagValue => {
                // 检查是否为预设标签
                const predefinedTag = document.querySelector(`.tag[data-tag="${tagValue}"]`);
                
                if (predefinedTag) {
                    // 如果是预设标签，选中它
                    predefinedTag.classList.add('selected');
                }
                
                // 创建已选标签元素
                const tagElement = document.createElement('div');
                tagElement.className = 'selected-tag' + (predefinedTag ? '' : ' custom');
                tagElement.dataset.value = tagValue;
                tagElement.innerHTML = `
                    ${tagValue}
                    <span class="remove-tag">&times;</span>
                `;
                
                // 添加移除标签功能
                tagElement.querySelector('.remove-tag').addEventListener('click', () => {
                    tagElement.remove();
                    if (predefinedTag) {
                        predefinedTag.classList.remove('selected');
                    }
                    App._updateSystemPromptPreview();
                });
                
                selectedTagsContainer.appendChild(tagElement);
            });
        }
        
        // 更新系统提示预览
        App._updateSystemPromptPreview();
    },
    
    // 更新用户设置UI
    updateUserSettingsUI: function(settings) {
        document.getElementById('user-name').value = settings.name || '';
        document.getElementById('user-avatar-url').value = settings.avatar || '';
        document.querySelector('#user-avatar-preview img').src = settings.avatar || 'https://via.placeholder.com/100';
        
        // 更新用户资料弹窗
        document.getElementById('profile-name').value = settings.name || '';
        document.getElementById('profile-bio').value = settings.bio || '';
        document.getElementById('profile-avatar-img').src = settings.avatar || 'https://via.placeholder.com/120';
    },
    
    // 更新外观设置UI
    updateAppearanceUI: function(appearance) {
        // 移除所有背景选项的selected类
        document.querySelectorAll('.background-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // 添加selected类到当前背景选项
        const selectedOption = document.querySelector(`.background-option[data-bg="${appearance.background}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        
        // 设置聊天区域背景
        const chatArea = document.getElementById('chat-area');
        chatArea.setAttribute('data-bg', appearance.background);
        
        // 如果是自定义背景，设置背景图片
        if (appearance.background === 'custom' && appearance.customBackground) {
            chatArea.style.setProperty('--custom-bg', `url(${appearance.customBackground})`);
            document.querySelector('.bg-custom').style.backgroundImage = `url(${appearance.customBackground})`;
            document.querySelector('.bg-custom').innerHTML = '';
        }
        
        // 设置主题
        document.body.setAttribute('data-theme', appearance.theme || 'light');
    },
    
    // 更新API设置UI
    updateApiSettingsUI: function(apiConfig) {
        document.getElementById('api-provider').value = apiConfig.provider || 'openai';
        document.getElementById('api-key').value = apiConfig.apiKey || '';
        document.getElementById('api-model').value = apiConfig.model || '';
        
        // 显示/隐藏端点输入框
        const endpointGroup = document.querySelector('.api-endpoint-group');
        if (apiConfig.provider === 'azure' || apiConfig.provider === 'other') {
            endpointGroup.style.display = 'block';
            document.getElementById('api-endpoint').value = apiConfig.endpoint || '';
        } else {
            endpointGroup.style.display = 'none';
        }
    },
    
    // 显示通知
    showNotification: function(message, type = 'info', duration = 3000) {
        const container = document.getElementById('notifications-container');
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = message;
        
        container.appendChild(notification);
        
        // 自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s forwards';
            
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
    }
};

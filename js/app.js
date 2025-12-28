// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 主应用对象
const App = {
    currentConversation: null,
    isLoading: false,
    proactiveTimer: null,  // 主动消息定时器
    messageQueue: [],      // 消息队列
    
    // 初始化应用
    init: function() {
        this._loadInitialData();
        this._setupEventListeners();
        this._setupMobileUI();
        this._setupProactiveMessaging();  // 设置主动消息功能
    },
    
    // 加载初始数据
    _loadInitialData: function() {
        // 加载角色信息
        const character = StorageService.getCharacter();
        UIComponents.updateCharacterUI(character);
        
        // 加载用户设置
        const userSettings = StorageService.getUserSettings();
        UIComponents.updateUserSettingsUI(userSettings);
        
        // 加载外观设置
        const appearance = StorageService.getAppearance();
        UIComponents.updateAppearanceUI(appearance);
        
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
        // ===== 主要功能按钮 =====
        
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
        
        // 消息输入框内容变化调整高度和启用/禁用发送按钮
        const debouncedTextareaHandler = UIComponents._debounce((e) => {
            UIComponents.updateTextareaHeight(e.target);
            document.getElementById('send-message-btn').disabled = !e.target.value.trim();
        }, 50);

        document.getElementById('message-input').addEventListener('input', debouncedTextareaHandler);
        
        // 搜索会话 - 使用防抖
        const debouncedSearch = UIComponents._debounce((e) => {
            const searchTerm = e.target.value.trim();
            const conversations = StorageService.searchConversations(searchTerm);
            UIComponents.renderConversations(conversations, this.currentConversation?.id);
        }, 300);

        document.getElementById('search-conversations').addEventListener('input', debouncedSearch);
        
        // ===== 设置面板 =====
        
        // 打开设置面板
        document.getElementById('settings-btn').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.add('active');
        });
        
        // 关闭设置面板
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.remove('active');
        });
        
        // 移动端打开设置面板
        document.getElementById('mobile-settings-toggle')?.addEventListener('click', () => {
            document.getElementById('settings-panel').classList.add('active');
        });
        
        // 设置选项卡切换
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', function() {
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelectorAll('.settings-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
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
        
        // 保存外观设置
        document.getElementById('save-appearance-btn').addEventListener('click', () => {
            this.saveAppearanceSettings();
        });
        
        // 测试API连接
        document.getElementById('test-api-btn').addEventListener('click', async () => {
            this.testApiConnection();
        });
        
        // 显示/隐藏API密钥
        document.getElementById('toggle-api-key').addEventListener('click', function() {
            const apiKeyInput = document.getElementById('api-key');
            const type = apiKeyInput.type === 'password' ? 'text' : 'password';
            apiKeyInput.type = type;
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
        
        // API提供商切换
        document.getElementById('api-provider').addEventListener('change', (e) => {
            const endpointGroup = document.querySelector('.api-endpoint-group');
            const selectedValue = e.target.value;
            if (selectedValue === 'azure' || selectedValue === 'other') {
                endpointGroup.style.display = 'block';
            } else {
                endpointGroup.style.display = 'none';
            }
        });
        
        // ===== 角色设置增强功能 =====

        // 性格标签点击
        document.querySelectorAll('#personality-tags .tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const tagValue = tag.dataset.tag;
                if (tag.classList.contains('selected')) {
                    // 取消选择
                    tag.classList.remove('selected');
                    const selectedTag = document.querySelector(`.selected-tag[data-value="${tagValue}"]`);
                    if (selectedTag) selectedTag.remove();
                } else {
                    // 选择标签
                    tag.classList.add('selected');
                    const selectedTagsContainer = document.getElementById('selected-personality-tags');
                    
                    const tagElement = document.createElement('div');
                    tagElement.className = 'selected-tag';
                    tagElement.dataset.value = tagValue;
                    tagElement.innerHTML = `
                        ${tagValue}
                        <span class="remove-tag">&times;</span>
                    `;
                    
                    // 添加移除标签功能
                    tagElement.querySelector('.remove-tag').addEventListener('click', () => {
                        tagElement.remove();
                        document.querySelector(`.tag[data-tag="${tagValue}"]`).classList.remove('selected');
                        this._updateSystemPromptPreview();
                    });
                    
                    selectedTagsContainer.appendChild(tagElement);
                }
                this._updateSystemPromptPreview();
            });
        });

        // 添加自定义标签
        document.getElementById('add-custom-tag-btn').addEventListener('click', () => {
            const customTagInput = document.getElementById('custom-tag-input');
            const customTag = customTagInput.value.trim();
            
            if (customTag) {
                const selectedTagsContainer = document.getElementById('selected-personality-tags');
                
                // 检查是否已存在
                const existingTag = document.querySelector(`.selected-tag[data-value="${customTag}"]`);
                if (!existingTag) {
                    const tagElement = document.createElement('div');
                    tagElement.className = 'selected-tag custom';
                    tagElement.dataset.value = customTag;
                    tagElement.innerHTML = `
                        ${customTag}
                        <span class="remove-tag">&times;</span>
                    `;
                    
                    // 添加移除标签功能
                    tagElement.querySelector('.remove-tag').addEventListener('click', () => {
                        tagElement.remove();
                        this._updateSystemPromptPreview();
                    });
                    
                    selectedTagsContainer.appendChild(tagElement);
                }
                
                customTagInput.value = '';
                this._updateSystemPromptPreview();
            }
        });

        // 更新系统提示预览 - 使用防抖
        const debouncedUpdatePrompt = UIComponents._debounce(() => this._updateSystemPromptPreview(), 300);

        document.getElementById('character-description').addEventListener('input', debouncedUpdatePrompt);
        document.getElementById('speech-style').addEventListener('input', debouncedUpdatePrompt);
        document.getElementById('character-rules').addEventListener('input', debouncedUpdatePrompt);
        document.getElementById('character-knowledge').addEventListener('input', debouncedUpdatePrompt);

        // 复制系统提示
        document.getElementById('copy-prompt-btn').addEventListener('click', () => {
            const promptText = document.getElementById('system-prompt-preview').innerText;
            navigator.clipboard.writeText(promptText).then(() => {
                UIComponents.showNotification('系统提示已复制到剪贴板');
            }).catch(err => {
                console.error('Failed to copy: ', err);
                UIComponents.showNotification('复制失败，请手动选择复制', 'error');
            });
        });

        // 提示帮助信息
        document.getElementById('prompt-help').addEventListener('click', () => {
            UIComponents.showNotification('系统提示是发送给AI的指令，会根据您填写的角色信息自动生成', 'info', 5000);
        });
        
        // ===== 头像上传 =====
        
        // AI头像上传按钮
        document.getElementById('ai-avatar-upload-btn').addEventListener('click', () => {
            document.getElementById('ai-avatar-file').click();
        });
        
        // AI头像文件选择
        document.getElementById('ai-avatar-file').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                try {
                    const file = e.target.files[0];
                    const base64Image = await StorageService.imageToBase64(file);
                    
                    document.querySelector('#ai-avatar-preview img').src = base64Image;
                    document.getElementById('character-avatar').value = base64Image;
                } catch (error) {
                    console.error('Image conversion error:', error);
                    UIComponents.showNotification('图片上传失败，请重试。', 'error');
                }
            }
        });
        
        // 用户头像上传按钮
        document.getElementById('user-avatar-upload-btn').addEventListener('click', () => {
            document.getElementById('user-avatar-file').click();
        });
        
        // 用户头像文件选择
        document.getElementById('user-avatar-file').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                try {
                    const file = e.target.files[0];
                    const base64Image = await StorageService.imageToBase64(file);
                    
                    document.querySelector('#user-avatar-preview img').src = base64Image;
                    document.getElementById('user-avatar-url').value = base64Image;
                } catch (error) {
                    console.error('Image conversion error:', error);
                    UIComponents.showNotification('图片上传失败，请重试。', 'error');
                }
            }
        });
        
        // 用户头像URL输入
        document.getElementById('user-avatar-url').addEventListener('input', (e) => {
            document.querySelector('#user-avatar-preview img').src = e.target.value || 'https://via.placeholder.com/100';
        });
        
        // AI头像URL输入
        document.getElementById('character-avatar').addEventListener('input', (e) => {
            document.querySelector('#ai-avatar-preview img').src = e.target.value || 'https://via.placeholder.com/100';
        });
        
        // ===== 聊天背景 =====
        
        // 背景选项点击
        document.querySelectorAll('.background-option').forEach(option => {
            option.addEventListener('click', function() {
                const bgType = this.dataset.bg;
                
                document.querySelectorAll('.background-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                this.classList.add('selected');
                
                if (bgType === 'custom') {
                    document.getElementById('bg-upload').click();
                } else {
                    document.getElementById('chat-area').setAttribute('data-bg', bgType);
                }
            });
        });
        
        // 背景图片上传
        document.getElementById('bg-upload').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                try {
                    const file = e.target.files[0];
                    const base64Image = await StorageService.imageToBase64(file);
                    
                    // 设置背景图片
                    const chatArea = document.getElementById('chat-area');
                    chatArea.setAttribute('data-bg', 'custom');
                    chatArea.style.setProperty('--custom-bg', `url(${base64Image})`);
                    
                    // 更新自定义背景预览
                    const customBgPreview = document.querySelector('.bg-custom');
                    customBgPreview.style.backgroundImage = `url(${base64Image})`;
                    customBgPreview.innerHTML = '';
                    
                    // 更新选中状态
                    document.querySelectorAll('.background-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    document.querySelector('.background-option[data-bg="custom"]').classList.add('selected');
                    
                } catch (error) {
                    console.error('Background image conversion error:', error);
                    UIComponents.showNotification('背景图片上传失败，请重试。', 'error');
                }
            }
        });
        
        // ===== 记忆功能 =====
        
        // 生成记忆按钮
        document.getElementById('generate-memory-btn').addEventListener('click', () => {
            this.generateMemory();
        });
        
        // 添加记忆按钮
        document.getElementById('add-memory-btn').addEventListener('click', () => {
            this.addNewMemory();
        });
        
        // ===== 导入导出 =====
        
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
        
        // ===== 用户资料 =====
        
        // 打开用户资料弹窗
        document.getElementById('user-profile-btn').addEventListener('click', () => {
            document.getElementById('user-profile-modal').classList.add('active');
            
            // 加载当前用户设置
            const userSettings = StorageService.getUserSettings();
            document.getElementById('profile-name').value = userSettings.name || '';
            document.getElementById('profile-bio').value = userSettings.bio || '';
            document.getElementById('profile-avatar-img').src = userSettings.avatar || 'https://via.placeholder.com/120';
        });
        
        // 关闭用户资料弹窗
        document.getElementById('close-profile-modal').addEventListener('click', () => {
            document.getElementById('user-profile-modal').classList.remove('active');
        });
        
        document.getElementById('cancel-profile').addEventListener('click', () => {
            document.getElementById('user-profile-modal').classList.remove('active');
        });
        
        // 保存用户资料
        document.getElementById('save-profile').addEventListener('click', () => {
            const name = document.getElementById('profile-name').value.trim();
            const bio = document.getElementById('profile-bio').value.trim();
            const avatar = document.getElementById('profile-avatar-img').src;
            
            const userSettings = {
                ...StorageService.getUserSettings(),
                name: name || '我',
                bio: bio,
                avatar: avatar
            };
            
            StorageService.saveUserSettings(userSettings);
            UIComponents.updateUserSettingsUI(userSettings);
            UIComponents.showNotification('用户资料已保存');
            
            document.getElementById('user-profile-modal').classList.remove('active');
            
            // 重新渲染当前会话的消息（以更新用户头像）
            if (this.currentConversation) {
                UIComponents.renderMessages(this.currentConversation.messages, StorageService.getCharacter());
            }
        });
        
        // 编辑用户头像
        document.getElementById('edit-profile-avatar').addEventListener('click', () => {
            document.getElementById('profile-avatar-file').click();
        });
        
        // 用户头像文件选择（资料弹窗）
        document.getElementById('profile-avatar-file').addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                try {
                    const file = e.target.files[0];
                    const base64Image = await StorageService.imageToBase64(file);
                    
                    document.getElementById('profile-avatar-img').src = base64Image;
                } catch (error) {
                    console.error('Image conversion error:', error);
                    UIComponents.showNotification('图片上传失败，请重试。', 'error');
                }
            }
        });
    },
    
    // 设置移动端UI
    _setupMobileUI: function() {
        // 移动端侧边栏切换
        document.getElementById('mobile-sidebar-toggle')?.addEventListener('click', function() {
            document.getElementById('sidebar').classList.add('active');
        });
        
        // 点击外部关闭侧边栏和设置面板
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const settingsPanel = document.getElementById('settings-panel');
                const mobileToggle = document.getElementById('mobile-sidebar-toggle');
                
                if (sidebar.classList.contains('active') && 
                    !sidebar.contains(e.target) && 
                    e.target !== mobileToggle &&
                    !mobileToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
                
                // 点击外部关闭设置面板
                const settingsToggle = document.getElementById('mobile-settings-toggle');
                if (settingsPanel.classList.contains('active') && 
                    !settingsPanel.contains(e.target) && 
                    e.target !== settingsToggle &&
                    !settingsToggle.contains(e.target)) {
                    settingsPanel.classList.remove('active');
                }
            }
        });
    },
    
    // 设置主动消息功能
    _setupProactiveMessaging: function() {
        // 检查页面打开时是否需要发送主动消息
        this._checkForPendingProactiveMessages();
        
        // 设置定时器，定期检查是否需要发送主动消息（每10分钟检查一次）
        this.proactiveTimer = setInterval(() => {
            this._checkForPendingProactiveMessages();
        }, 10 * 60 * 1000);
        
        // 页面关闭或隐藏时，清除定时器
        window.addEventListener('beforeunload', () => {
            if (this.proactiveTimer) {
                clearInterval(this.proactiveTimer);
            }
        });
        
        // 页面从隐藏变为可见时，立即检查
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this._checkForPendingProactiveMessages();
            }
        });
    },
    
    // 检查是否需要发送主动消息
    _checkForPendingProactiveMessages: function() {
        if (!this.currentConversation || this.isLoading) return;
        
        // 检索当前会话的主动消息状态
        const proactiveState = StorageService.getProactiveState(this.currentConversation.id);
        
        // 获取当前时间
        const now = Date.now();
        
        // 如果没有消息，不需要主动发送
        if (this.currentConversation.messages.length === 0) return;
        
        // 获取最后一条消息
        const lastMessage = this.currentConversation.messages[this.currentConversation.messages.length - 1];
        
        // 如果最后一条是AI消息，且是主动发送的，且已经发送了4条，则不再发送
        if (lastMessage.role === 'assistant' && 
            proactiveState && 
            proactiveState.sentCount >= 4) {
            return;
        }
        
        // 如果最后一条是用户消息，或者是AI的非主动消息
        if (lastMessage.role === 'user' || 
            (lastMessage.role === 'assistant' && (!proactiveState || !proactiveState.lastProactiveTime || proactiveState.sentCount < 4))) {
            
            // 计算自上次消息以来的时间（小时）
            const hoursElapsed = (now - lastMessage.timestamp) / (1000 * 60 * 60);
            
            // 如果超过48小时且AI已经发送了主动消息，则不再发送
            if (hoursElapsed > 48 && proactiveState && proactiveState.sentCount > 0) {
                return;
            }
            
            // 如果在10-48小时之间，且最后一条是用户消息或AI的回复，则发送主动消息
            // 为了测试，我们可以设置更短的时间，比如10分钟到48小时
            // 实际使用时，可以根据需要调整时间间隔
            const minTimeHours = 10; // 最短10小时
            // 为测试目的，将其改为10分钟：const minTimeMinutes = 10;
            
            if (hoursElapsed >= minTimeHours && hoursElapsed <= 48) {
                // 如果有proactiveState，检查上次主动发送时间
                if (proactiveState && proactiveState.lastProactiveTime) {
                    const hoursSinceLastProactive = (now - proactiveState.lastProactiveTime) / (1000 * 60 * 60);
                    // 确保距离上次主动消息至少5小时以上
                    // 为测试目的，可以改为5分钟：const minIntervalMinutes = 5;
                    const minIntervalHours = 5;
                    if (hoursSinceLastProactive < minIntervalHours) {
                        return;
                    }
                }
                
                // 发送主动消息
                this._sendProactiveMessage();
            }
        }
    },
    
    // 发送主动消息
    _sendProactiveMessage: async function() {
        if (!this.currentConversation || this.isLoading) return;
        
        // 获取当前的主动状态
        let proactiveState = StorageService.getProactiveState(this.currentConversation.id) || {
            sentCount: 0,
            lastProactiveTime: null
        };
        
        // 如果已经发送了4条消息，不再发送
        if (proactiveState.sentCount >= 4) return;
        
        this.isLoading = true;
        
        try {
            const character = StorageService.getCharacter();
            
            // 构建系统提示
            let systemPrompt = '';
            if (character.description) {
                systemPrompt += character.description + "\n\n";
            }
            
            if (character.personalityTags && character.personalityTags.length > 0) {
                systemPrompt += `性格特点: ${character.personalityTags.join('、')}\n\n`;
            }
            
            if (character.speechStyle) {
                systemPrompt += `说话风格示例:\n${character.speechStyle}\n\n`;
            }
            
            if (character.knowledge) {
                systemPrompt += `你特别擅长: ${character.knowledge}\n\n`;
            }
            
            if (character.rules) {
                systemPrompt += `行为规则:\n${character.rules}\n\n`;
            }
            
            // 添加主动消息的特殊指令
            systemPrompt += `现在，用户已经有一段时间没有回复你了。请发送一条友好的主动消息。根据之前的对话内容，你可以：
1. 继续之前的话题，提供更多见解或问题
2. 分享一个有趣的新话题或事实
3. 询问用户近况或表达关心
4. 提供一些有用的信息或建议
请保持自然、友好的语气，不要过于刻意或打扰用户。这是你的第${proactiveState.sentCount + 1}条主动消息。`;
            
            // 获取对话上下文
            const messages = this.currentConversation.messages.slice(-10);
            
            // 准备发送给AI的记忆列表
            const memories = [
                ...character.memories, // 全局记忆
                ...this.currentConversation.memories // 会话级记忆
            ];
            
            // 调用AI服务生成主动消息
            const aiResponse = await AIService.sendMessage(
                messages,
                systemPrompt,
                memories
            );
            
            // 处理分段发送消息
            this._sendSegmentedMessage(aiResponse.content, true);
            
            // 更新主动消息状态
            proactiveState.sentCount += 1;
            proactiveState.lastProactiveTime = Date.now();
            StorageService.saveProactiveState(this.currentConversation.id, proactiveState);
            
            console.log(`已发送第${proactiveState.sentCount}条主动消息`);
            
        } catch (error) {
            console.error('发送主动消息失败:', error);
            this.isLoading = false;
        }
    },
    
    // 分段发送消息函数
    _sendSegmentedMessage: function(content, isProactive = false) {
        // 根据空行分段消息
        const segments = content.split(/\n\s*\n/).filter(segment => segment.trim() !== '');
        
        if (segments.length === 0) return;
        
        // 清除现有的消息队列
        this.messageQueue = [];
        
        // 将段落添加到消息队列
        segments.forEach((segment, index) => {
            this.messageQueue.push({
                content: segment.trim(),
                isLast: index === segments.length - 1,
                isProactive: isProactive
            });
        });
        
        // 开始发送第一条消息
        this._processMessageQueue();
    },
    
    // 处理消息队列
    _processMessageQueue: function() {
        if (this.messageQueue.length === 0 || !this.currentConversation) {
            this.isLoading = false;
            return;
        }
        
        const nextMessage = this.messageQueue.shift();
        const isLast = nextMessage.isLast;
        
        // 构建AI消息对象
        const aiMessage = {
            id: generateId(),
            role: 'assistant',
            content: nextMessage.content,
            timestamp: Date.now(),
            isProactive: nextMessage.isProactive,
            isContinued: this.messageQueue.length > 0 // 标记是否有后续消息
        };
        
        // 更新会话
        this.currentConversation.messages.push(aiMessage);
        this.currentConversation.updatedAt = Date.now();
        StorageService.saveConversation(this.currentConversation);
        
        // 更新UI
        const character = StorageService.getCharacter();
        UIComponents.renderMessages(this.currentConversation.messages, character);
        UIComponents.renderConversations(StorageService.getConversations(), this.currentConversation.id);
        
        // 如果还有消息，设置定时器发送下一条
        if (this.messageQueue.length > 0) {
            // 随机生成间隔时间，范围在15-40秒之间
            const delay = Math.floor(Math.random() * (40 - 15 + 1) + 15) * 1000;
            
            // 在间隔时间结束前显示输入指示器
            UIComponents.addTypingIndicator(character);
            
            setTimeout(() => {
                UIComponents.removeTypingIndicator();
                this._processMessageQueue();
            }, delay);
        } else {
            // 所有消息发送完毕
            this.isLoading = false;
        }
    },
    
    // 更新系统提示预览
    _updateSystemPromptPreview: function() {
        const description = document.getElementById('character-description').value.trim();
        const speechStyle = document.getElementById('speech-style').value.trim();
        const rules = document.getElementById('character-rules').value.trim();
        const knowledge = document.getElementById('character-knowledge').value.trim();
        
        // 收集所有已选择的标签
        const personalityTags = [];
        document.querySelectorAll('#selected-personality-tags .selected-tag').forEach(tag => {
            personalityTags.push(tag.dataset.value);
        });
        
        let prompt = "";
        
        // 基本人设描述
        if (description) {
            prompt += description + "\n\n";
        } else {
            prompt += "你是一个有帮助的AI助手。\n\n";
        }
        
        // 性格标签
        if (personalityTags.length > 0) {
            prompt += `性格特点: ${personalityTags.join('、')}\n\n`;
        }
        
        // 说话风格
        if (speechStyle) {
            prompt += `说话风格示例:\n${speechStyle}\n\n`;
        }
        
        // 专业知识
        if (knowledge) {
            prompt += `你特别擅长: ${knowledge}\n\n`;
        }
        
        // 行为规则
        if (rules) {
            prompt += `行为规则:\n${rules}\n`;
        }
        
        // 更新预览
        document.getElementById('system-prompt-preview').textContent = prompt;
    },
    
    // 创建新会话
    createNewConversation: function() {
        const id = generateId();
        const newConversation = {
            id: id,
            title: '新对话',
            messages: [],
            memories: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        // 保存并加载新会话
        StorageService.saveConversation(newConversation);
        StorageService.setCurrentConversationId(id);
        this.currentConversation = newConversation;
        
        // 初始化主动消息状态
        StorageService.saveProactiveState(id, {
            sentCount: 0,
            lastProactiveTime: null
        });
        
        // 更新UI
        const conversations = StorageService.getConversations();
        UIComponents.renderConversations(conversations, id);
        UIComponents.renderMessages([], StorageService.getCharacter());
        
        // 更新会话标题
        document.getElementById('current-conversation-title').textContent = StorageService.getCharacter().name;
        
        // 清空输入框
        document.getElementById('message-input').value = '';
        document.getElementById('message-input').style.height = 'auto';
        document.getElementById('send-message-btn').disabled = true;
        
        // 更新记忆面板
        const character = StorageService.getCharacter();
        UIComponents.renderMemories(character.memories);
        
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
        document.getElementById('current-conversation-title').textContent = 
            conversation.title || character.name || 'AI助手';
        
        // 更新记忆面板
        const allMemories = [...character.memories, ...conversation.memories];
        UIComponents.renderMemories(allMemories);
        
        // 加载后立即检查是否需要发送主动消息
        setTimeout(() => {
            this._checkForPendingProactiveMessages();
        }, 2000);
        
        // 聚焦输入框
        document.getElementById('message-input').focus();
    },
    
    // 删除会话
    deleteConversation: function(id) {
        const conversations = StorageService.deleteConversation(id);
        
        // 删除会话的主动消息状态
        StorageService.deleteProactiveState(id);
        
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
            timestamp: Date.now(),
            isRead: false
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
        
        // 重置主动消息计数器（用户发送消息后，重新开始计时）
        StorageService.saveProactiveState(this.currentConversation.id, {
            sentCount: 0,
            lastProactiveTime: null
        });
        
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
            let systemPrompt = '';
            if (character.description) {
                systemPrompt += character.description + "\n\n";
            }
            
            if (character.personalityTags && character.personalityTags.length > 0) {
                systemPrompt += `性格特点: ${character.personalityTags.join('、')}\n\n`;
            }
            
            if (character.speechStyle) {
                systemPrompt += `说话风格示例:\n${character.speechStyle}\n\n`;
            }
            
            if (character.knowledge) {
                systemPrompt += `你特别擅长: ${character.knowledge}\n\n`;
            }
            
            if (character.rules) {
                systemPrompt += `行为规则:\n${character.rules}\n`;
            }
            
            // 调用AI服务
            const aiResponse = await AIService.sendMessage(
                this.currentConversation.messages, 
                systemPrompt, 
                memories
            );
            
            // 将用户消息标记为已读
            userMessage.isRead = true;
            this.currentConversation.messages[this.currentConversation.messages.length - 1] = userMessage;
            StorageService.saveConversation(this.currentConversation);
            
            // 移除加载中指示器
            UIComponents.removeLoadingIndicator();
            
            // 使用分段发送函数处理AI回复
            this._sendSegmentedMessage(aiResponse.content);
            
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
                content: `错误: ${error.message || '无法获取AI响应'}`,
                timestamp: Date.now()
            };
            
            this.currentConversation.messages.push(errorMessage);
            StorageService.saveConversation(this.currentConversation);
            
            // 更新UI
            UIComponents.renderMessages(this.currentConversation.messages, character);
            UIComponents.renderConversations(StorageService.getConversations(), this.currentConversation.id);
            
            // 显示错误通知
            UIComponents.showNotification('无法获取AI响应，请检查API设置。', 'error');
            
            // 移除加载中指示器
            UIComponents.removeLoadingIndicator();
            this.isLoading = false;
        }
    },
    
    // 生成记忆
    generateMemory: async function() {
        if (!this.currentConversation || this.currentConversation.messages.length < 2) {
            UIComponents.showNotification('对话内容太少，无法生成有意义的记忆。', 'error');
            return;
        }
        
        // 添加系统消息，表示正在生成记忆
        const processingMessage = {
            id: generateId(),
            role: 'system',
            content: '正在从最近的对话生成记忆...',
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
                if (lastMessage.role === 'system' && lastMessage.content.includes('正在从最近的对话生成记忆')) {
                    lastMessage.content = `已创建记忆: "${memorySummary}"`;
                    lastMessage.timestamp = Date.now();
                }
                
                // 保存会话
                StorageService.saveConversation(this.currentConversation);
                
                // 更新UI
                UIComponents.renderMessages(this.currentConversation.messages, character);
                
                // 更新记忆面板
                const allMemories = [...character.memories, ...this.currentConversation.memories];
                UIComponents.renderMemories(allMemories);
                
                UIComponents.showNotification('记忆生成成功');
            } else {
                throw new Error('无法生成记忆摘要');
            }
            
        } catch (error) {
            console.error('Memory generation error:', error);
            
            // 更新错误消息
            const lastMessage = this.currentConversation.messages[this.currentConversation.messages.length - 1];
            if (lastMessage.role === 'system' && lastMessage.content.includes('正在从最近的对话生成记忆')) {
                lastMessage.content = `记忆生成失败: ${error.message}`;
                lastMessage.timestamp = Date.now();
            }
            
            // 保存会话
            StorageService.saveConversation(this.currentConversation);
            
            // 更新UI
            UIComponents.renderMessages(this.currentConversation.messages, character);
            
            UIComponents.showNotification('记忆生成失败，请重试。', 'error');
        }
    },
    
    // 添加新的记忆
    addNewMemory: function() {
        const memoryContent = document.getElementById('new-memory').value.trim();
        const isGlobal = document.getElementById('memory-is-global').checked;
        
        if (!memoryContent) {
            UIComponents.showNotification('请输入记忆内容。', 'error');
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
                UIComponents.showNotification('请先选择或创建一个会话。', 'error');
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
        UIComponents.showNotification('记忆添加成功');
        
        // 添加系统消息到当前会话
        if (this.currentConversation) {
            const systemMessage = {
                id: generateId(),
                role: 'system',
                content: `已添加${isGlobal ? '全局' : '会话'}记忆: "${memoryContent}"`,
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
                    content: '已从当前会话删除一条记忆',
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
        UIComponents.showNotification('记忆已删除');
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
            
            UIComponents.showNotification('请编辑记忆内容后点击"添加记忆"保存更改');
        }
    },
    
    // 保存角色设置
    saveCharacterSettings: function() {
        const character = StorageService.getCharacter();
        
        // 获取已选择的性格标签
        const selectedTags = [];
        document.querySelectorAll('#selected-personality-tags .selected-tag').forEach(tag => {
            selectedTags.push(tag.dataset.value);
        });
        
        // 更新角色信息
        character.name = document.getElementById('character-name').value.trim() || 'AI助手';
        character.avatar = document.querySelector('#ai-avatar-preview img').src || 'https://via.placeholder.com/150';
        character.description = document.getElementById('character-description').value.trim() || '';
        character.personalityTags = selectedTags;
        character.speechStyle = document.getElementById('speech-style').value.trim() || '';
        character.rules = document.getElementById('character-rules').value.trim() || '';
        character.knowledge = document.getElementById('character-knowledge').value.trim() || '';
        
        // 保存角色信息
        StorageService.saveCharacter(character);
        
        // 更新UI
        UIComponents.updateCharacterUI(character);
        
        // 如果有当前会话，重新渲染消息
        if (this.currentConversation) {
            UIComponents.renderMessages(this.currentConversation.messages, character);
        }
        
        // 更新会话列表（更新头像）
        UIComponents.renderConversations(
            StorageService.getConversations(), 
            this.currentConversation?.id
        );
        
        UIComponents.showNotification('角色设置已保存');
        
        // 关闭设置面板
        if (window.innerWidth <= 768) {
            document.getElementById('settings-panel').classList.remove('active');
        }
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
        
        UIComponents.showNotification('API设置已保存');
        
        // 关闭设置面板
        if (window.innerWidth <= 768) {
            document.getElementById('settings-panel').classList.remove('active');
        }
    },
    
    // 保存外观设置
    saveAppearanceSettings: function() {
        // 获取当前外观设置
        const appearance = StorageService.getAppearance();
        
        // 更新用户设置
        const userSettings = StorageService.getUserSettings();
        userSettings.name = document.getElementById('user-name').value.trim() || '我';
        userSettings.avatar = document.querySelector('#user-avatar-preview img').src;
        
        // 更新背景设置
        const selectedBgOption = document.querySelector('.background-option.selected');
        appearance.background = selectedBgOption ? selectedBgOption.dataset.bg : 'default';
        
        // 如果是自定义背景，保存背景图片
        if (appearance.background === 'custom') {
            const customBgStyle = document.querySelector('.bg-custom').style.backgroundImage;
            if (customBgStyle) {
                const urlMatch = customBgStyle.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (urlMatch && urlMatch[1]) {
                    appearance.customBackground = urlMatch[1];
                }
            }
        }
        
        // 保存设置
        StorageService.saveUserSettings(userSettings);
        StorageService.saveAppearance(appearance);
        
        // 更新UI
        UIComponents.updateUserSettingsUI(userSettings);
        UIComponents.updateAppearanceUI(appearance);
        
        // 如果有当前会话，重新渲染消息（以更新用户头像）
        if (this.currentConversation) {
            UIComponents.renderMessages(this.currentConversation.messages, StorageService.getCharacter());
        }
        
        UIComponents.showNotification('外观设置已保存');
        
        // 关闭设置面板
        if (window.innerWidth <= 768) {
            document.getElementById('settings-panel').classList.remove('active');
        }
    },
    
    // 测试API连接
    testApiConnection: async function() {
        // 先保存设置
        this.saveApiSettings();
        
        UIComponents.showNotification('正在测试API连接...');
        
        try {
            const result = await AIService.testConnection();
            
            if (result.success) {
                UIComponents.showNotification('连接成功！API响应正常。', 'success');
            } else {
                UIComponents.showNotification(`连接失败：${result.message}`, 'error');
            }
        } catch (error) {
            console.error('API test error:', error);
            UIComponents.showNotification(`连接测试错误: ${error.message}`, 'error');
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
        
        UIComponents.showNotification('数据导出成功');
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
                    UIComponents.showNotification('数据导入成功');
                } else {
                    throw new Error('数据格式无效');
                }
            } catch (error) {
                console.error('Import error:', error);
                UIComponents.showNotification(`导入失败: ${error.message}`, 'error');
            }
        };
        
        reader.readAsText(file);
    },
    
    // 切换消息表情反应
    toggleReaction: function(messageId, emoji) {
        if (!this.currentConversation) return;
        
        // 查找消息
        const message = this.currentConversation.messages.find(m => m.id === messageId);
        if (!message) return;
        
        // 初始化反应对象
        if (!message.reactions) {
            message.reactions = {};
        }
        
        // 切换反应状态
        if (message.reactions[emoji]) {
            message.reactions[emoji] -= 1;
            if (message.reactions[emoji] <= 0) {
                delete message.reactions[emoji];
            }
        } else {
            message.reactions[emoji] = 1;
        }
        
        // 保存会话
        StorageService.saveConversation(this.currentConversation);
        
        // 更新UI
        const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
        if (messageElement) {
            const reactionsContainer = messageElement.querySelector('.message-reactions');
            reactionsContainer.innerHTML = UIComponents._renderReactions(message.reactions);
            
            // 重新添加事件监听器
            messageElement.querySelectorAll('.reaction').forEach(reaction => {
                reaction.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleReaction(messageId, reaction.dataset.emoji);
                });
            });
        }
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});

// 需要在UIComponents中添加"正在输入"指示器函数
// 假设这部分代码已经在components.js中实现

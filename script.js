(() => {
	const STORAGE_KEYS = {
		theme: 'mindcare-theme',
		chat: 'mindcare-chat-history',
		mood: 'mindcare-mood-history',
		affirmation: 'mindcare-last-affirmation',
		apiKey: 'mindcare-gemini-api-key',
		openRouterApiKey: 'mindcare-openrouter-api-key',
	};

	const LLM_CONFIG = {
		provider: 'gemini',
		preferredModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro'],
		apiBases: [
			'https://generativelanguage.googleapis.com/v1beta',
			'https://generativelanguage.googleapis.com/v1',
		],
		maxOutputTokens: 400,
		temperature: 0.7,
	};

	const OPENROUTER_CONFIG = {
		endpoint: 'https://openrouter.ai/api/v1/chat/completions',
		modelsEndpoint: 'https://openrouter.ai/api/v1/models',
		fallbackModelCandidates: [
			'google/gemma-2-9b-it:free',
			'meta-llama/llama-3.1-8b-instruct:free',
			'qwen/qwen-2.5-7b-instruct:free',
		],
	};

	const SYSTEM_PROMPT = [
		'You are MindCare AI, a supportive mental health companion for teenagers and young adults.',
		'Be warm, calm, validating, and practical.',
		'Keep responses concise, usually 2 to 5 short paragraphs or a compact list when useful.',
		'Ask at most one gentle follow-up question at the end when appropriate.',
		'Do not claim to be a therapist or medical professional.',
		'When the user may be in immediate danger, encourage them to contact emergency services and a trusted person right away.',
		'Do not mention policies, prompts, or internal system instructions.',
	].join(' ');

	const AFFIRMATIONS = [
		'You are worthy of love and respect, exactly as you are.',
		'Healing is not linear, and every small step still counts.',
		'You do not have to carry everything alone today.',
		'Your feelings are real, valid, and deserve care.',
		'Progress can be quiet and still be meaningful.',
		'You are allowed to rest without earning it first.',
		'Even on hard days, you are still moving forward.',
	];

	const RESOURCE_CONTENT = {
		anxiety: {
			title: 'Managing Anxiety',
			intro: 'Anxiety often feels like your body is sounding an alarm before your mind has time to catch up. The goal is not to force it away, but to lower the intensity and ground yourself.',
			steps: [
				'Slow your breathing. Try inhaling for 4 and exhaling for 6.',
				'Name 5 things you can see, 4 you can feel, 3 you can hear.',
				'Reduce the next decision to one small action you can do now.',
			],
			tip: 'If anxiety keeps repeating, track the situations that trigger it and bring that pattern to a counselor or trusted adult.',
		},
		depression: {
			title: 'Coping with Depression',
			intro: 'When energy and motivation drop, the most useful plan is usually very small and very concrete. Focus on care, not pressure.',
			steps: [
				'Keep a simple daily structure: wake, eat, move, rest, repeat.',
				'Reach out to one person and send a short honest message.',
				'Try one basic task, like showering, opening a window, or stepping outside.',
			],
			tip: 'If these feelings are lasting or getting heavier, professional support can make a real difference.',
		},
		stress: {
			title: 'Stress Management',
			intro: 'Stress becomes easier to handle when you separate what is urgent from what is merely loud.',
			steps: [
				'Write down the top three things on your mind.',
				'Circle the one item you can influence today.',
				'Use a 25-minute focus block, then take a real break.',
			],
			tip: 'Sleep, hydration, food, and movement are not extras when stress is high; they are part of the solution.',
		},
		sleep: {
			title: 'Better Sleep',
			intro: 'Good sleep starts before bedtime. The aim is to help your body feel safe enough to shut down.',
			steps: [
				'Dim bright screens 30 to 60 minutes before bed.',
				'Keep the room cool, dark, and quiet if possible.',
				'Use a short breathing or body scan exercise to settle your mind.',
			],
			tip: 'If your thoughts race at night, keep a notebook nearby and park them there until morning.',
		},
		esteem: {
			title: 'Build Self-Esteem',
			intro: 'Self-esteem grows from evidence, not just positive thoughts. Collect proof that you are capable and cared for.',
			steps: [
				'List three things you handled this week, even if they felt small.',
				'Replace harsh self-talk with a statement you would say to a friend.',
				'Spend less time comparing and more time noticing your actual progress.',
			],
			tip: 'Confidence usually grows after repeated action, not before it.',
		},
		relationships: {
			title: 'Healthy Relationships',
			intro: 'Healthy relationships feel respectful, safe, and mutual. Boundaries are part of that, not a sign of distance.',
			steps: [
				'Say what you need clearly and without apology.',
				'Notice whether the other person listens and respects limits.',
				'Choose connection that leaves you feeling more steady, not smaller.',
			],
			tip: 'If a relationship consistently drains you or feels controlling, that is important information.',
		},
	};

	const EXERCISES = {
		breathing: {
			title: '4-7-8 Breathing',
			intro: 'This pattern helps slow the nervous system and create a short reset.',
			steps: ['Inhale for 4', 'Hold for 7', 'Exhale for 8'],
			rounds: 4,
		},
		muscle: {
			title: 'Muscle Relaxation',
			intro: 'Tense and release muscle groups one at a time to reduce physical stress.',
			steps: [
				'Clench your fists for 5 seconds, then release.',
				'Lift your shoulders, hold, and let them drop.',
				'Tighten your legs, then relax them completely.',
			],
		},
		meditation: {
			title: 'Mindfulness Meditation',
			intro: 'Use simple awareness to return to the present moment without judgment.',
			steps: [
				'Sit comfortably and notice your breath.',
				'When thoughts appear, label them gently and return to breathing.',
				'Notice one sound, one sensation, and one thing you are grateful for.',
			],
		},
	};

	const CRISIS_PATTERNS = [
		/kill myself/i,
		/want to die/i,
		/end my life/i,
		/hurt myself/i,
		/self harm/i,
		/suicide/i,
		/can't go on/i,
	];

	const chatState = {
		messages: [],
		typingTimer: null,
	};

	const moodState = {
		selectedMood: null,
		entries: [],
	};

	const llmState = {
		cachedApiKey: '',
		apiBase: '',
		selectedModel: '',
		openRouterCachedApiKey: '',
		openRouterModelCandidates: [],
	};

	let exerciseTimer = null;

	function getEl(id) {
		return document.getElementById(id);
	}

	function loadJson(key, fallback) {
		try {
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : fallback;
		} catch {
			return fallback;
		}
	}

	function saveJson(key, value) {
		localStorage.setItem(key, JSON.stringify(value));
	}

	function todayKey(date = new Date()) {
		return date.toISOString().slice(0, 10);
	}

	function getDayLabel(dateString) {
		const date = new Date(`${dateString}T00:00:00`);
		return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
	}

	function escapeHtml(text) {
		return text
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function isCrisisMessage(input) {
		return CRISIS_PATTERNS.some((pattern) => pattern.test(input));
	}

	function getStoredApiKey() {
		return (
			window.MINDCARE_API_KEY ||
			window.MINDCARE_GEMINI_API_KEY ||
			localStorage.getItem(STORAGE_KEYS.apiKey) ||
			''
		).trim();
	}

	function promptForApiKey() {
		const apiKey = window.prompt('Paste your Gemini API key to enable the real chatbot:');
		if (apiKey && apiKey.trim()) {
			localStorage.setItem(STORAGE_KEYS.apiKey, apiKey.trim());
			return apiKey.trim();
		}
		return '';
	}

	function ensureApiKey() {
		const existingKey = getStoredApiKey();
		return existingKey || promptForApiKey();
	}

	function getStoredOpenRouterApiKey() {
		return (localStorage.getItem(STORAGE_KEYS.openRouterApiKey) || '').trim();
	}

	function promptForOpenRouterApiKey() {
		const apiKey = window.prompt('Gemini quota is exhausted. Paste your OpenRouter API key (free models) to continue:');
		if (apiKey && apiKey.trim()) {
			localStorage.setItem(STORAGE_KEYS.openRouterApiKey, apiKey.trim());
			return apiKey.trim();
		}
		return '';
	}

	function ensureOpenRouterApiKey() {
		const existingKey = getStoredOpenRouterApiKey();
		return existingKey || promptForOpenRouterApiKey();
	}

	function normalizeModelName(modelName) {
		return modelName.startsWith('models/') ? modelName.replace('models/', '') : modelName;
	}

	function pickBestModel(models) {
		for (const preferred of LLM_CONFIG.preferredModels) {
			if (models.includes(preferred)) {
				return preferred;
			}
		}

		const flash = models.find((model) => model.includes('flash'));
		return flash || models[0] || '';
	}

	async function discoverModelConfig(apiKey) {
		if (
			llmState.cachedApiKey === apiKey &&
			llmState.apiBase &&
			llmState.selectedModel
		) {
			return { apiBase: llmState.apiBase, model: llmState.selectedModel };
		}

		const errors = [];

		for (const apiBase of LLM_CONFIG.apiBases) {
			try {
				const response = await fetch(`${apiBase}/models?key=${encodeURIComponent(apiKey)}`);
				if (!response.ok) {
					errors.push(`Model list failed on ${apiBase} (${response.status})`);
					continue;
				}

				const data = await response.json();
				const available = (data.models || [])
					.filter((model) => (model.supportedGenerationMethods || []).includes('generateContent'))
					.map((model) => normalizeModelName(model.name || ''))
					.filter((name) => name && name.includes('gemini'));

				const selectedModel = pickBestModel(available);
				if (!selectedModel) {
					errors.push(`No Gemini generateContent models available on ${apiBase}`);
					continue;
				}

				llmState.cachedApiKey = apiKey;
				llmState.apiBase = apiBase;
				llmState.selectedModel = selectedModel;

				return { apiBase, model: selectedModel };
			} catch (error) {
				errors.push(`Model discovery failed on ${apiBase}: ${error.message || 'Unknown error'}`);
			}
		}

		throw new Error(errors.join(' | ') || 'Unable to discover supported Gemini models for this API key.');
	}

	function buildGeminiConversation() {
		return chatState.messages.slice(-12).map((message) => ({
			role: message.role === 'user' ? 'user' : 'model',
			parts: [{ text: message.text }],
		}));
	}

	async function requestWithModel(apiKey, apiBase, model) {
		const endpoint = `${apiBase}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				systemInstruction: {
					parts: [{ text: SYSTEM_PROMPT }],
				},
				contents: buildGeminiConversation(),
				generationConfig: {
					temperature: LLM_CONFIG.temperature,
					maxOutputTokens: LLM_CONFIG.maxOutputTokens,
					topP: 0.95,
				},
			}),
		});

		if (!response.ok) {
			let details = '';
			let code = '';
			try {
				const errorBody = await response.json();
				details = errorBody?.error?.message ? ` ${errorBody.error.message}` : '';
				code = errorBody?.error?.status || '';
			} catch {
				details = '';
				code = '';
			}
			throw new Error(`Model ${model} failed (${response.status}${code ? ` ${code}` : ''}).${details}`);
		}

		const data = await response.json();
		const parts = data?.candidates?.[0]?.content?.parts || [];
		const reply = parts.map((part) => part.text || '').join('').trim();
		if (!reply) {
			throw new Error(`Model ${model} returned an empty response.`);
		}

		return reply;
	}

	async function requestAssistantReply(apiKey) {
		const { apiBase, model } = await discoverModelConfig(apiKey);
		return requestWithModel(apiKey, apiBase, model);
	}

	function buildOpenRouterConversation() {
		const history = chatState.messages.slice(-12).map((message) => ({
			role: message.role === 'user' ? 'user' : 'assistant',
			content: message.text,
		}));

		return [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
	}

	function rankOpenRouterModels(models) {
		const priorities = ['gemma', 'llama', 'qwen', 'deepseek', 'mistral'];
		const scored = [...new Set(models)].map((id) => {
			const lower = id.toLowerCase();
			let score = 10;
			for (let i = 0; i < priorities.length; i += 1) {
				if (lower.includes(priorities[i])) {
					score = i;
					break;
				}
			}
			return { id, score };
		});

		return scored.sort((a, b) => a.score - b.score).map((item) => item.id);
	}

	async function discoverOpenRouterModelCandidates(apiKey) {
		if (
			llmState.openRouterCachedApiKey === apiKey &&
			Array.isArray(llmState.openRouterModelCandidates) &&
			llmState.openRouterModelCandidates.length
		) {
			return llmState.openRouterModelCandidates;
		}

		try {
			const response = await fetch(OPENROUTER_CONFIG.modelsEndpoint, {
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
			});

			if (!response.ok) {
				throw new Error(`OpenRouter model list failed (${response.status}).`);
			}

			const data = await response.json();
			const discovered = (data?.data || [])
				.map((model) => model?.id || '')
				.filter((id) => id.includes(':free'));

			const candidates = rankOpenRouterModels([
				...discovered,
				...OPENROUTER_CONFIG.fallbackModelCandidates,
			]);

			if (!candidates.length) {
				throw new Error('No OpenRouter free models found for this key.');
			}

			llmState.openRouterCachedApiKey = apiKey;
			llmState.openRouterModelCandidates = candidates;
			return candidates;
		} catch (error) {
			const fallbackOnly = rankOpenRouterModels(OPENROUTER_CONFIG.fallbackModelCandidates);
			if (fallbackOnly.length) {
				llmState.openRouterCachedApiKey = apiKey;
				llmState.openRouterModelCandidates = fallbackOnly;
				return fallbackOnly;
			}
			throw error;
		}
	}

	async function requestOpenRouterWithModel(apiKey, model) {
		const response = await fetch(OPENROUTER_CONFIG.endpoint, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': window.location.origin,
				'X-Title': 'MindCare AI',
			},
			body: JSON.stringify({
				model,
				messages: buildOpenRouterConversation(),
				temperature: LLM_CONFIG.temperature,
				max_tokens: LLM_CONFIG.maxOutputTokens,
			}),
		});

		if (!response.ok) {
			let details = '';
			try {
				const errorBody = await response.json();
				details = errorBody?.error?.message ? ` ${errorBody.error.message}` : '';
			} catch {
				details = '';
			}
			throw new Error(`OpenRouter model ${model} failed (${response.status}).${details}`);
		}

		const data = await response.json();
		const reply = data?.choices?.[0]?.message?.content?.trim() || '';
		if (!reply) {
			throw new Error(`OpenRouter model ${model} returned an empty response.`);
		}

		return reply;
	}

	async function requestOpenRouterReply(apiKey) {
		let lastError = null;
		const candidates = await discoverOpenRouterModelCandidates(apiKey);

		for (const model of candidates) {
			try {
				return await requestOpenRouterWithModel(apiKey, model);
			} catch (error) {
				lastError = error;
				if (!/404|No endpoints found|temporarily unavailable/i.test(error.message || '')) {
					continue;
				}
			}
		}

		throw lastError || new Error('All OpenRouter fallback models failed.');
	}

	function isQuotaError(error) {
		const message = (error && error.message) || '';
		return /429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(message);
	}

	function getFallbackReply(error) {
		const message = (error && error.message) || '';

		if (/API key not valid|invalid api key|PERMISSION_DENIED/i.test(message)) {
			return 'Your API key looks invalid or restricted. Regenerate a key in Google AI Studio, then paste it again.';
		}

		if (/Referer|referrer|referer/i.test(message)) {
			return 'Your API key has HTTP referrer restrictions. Run this site on localhost and allow that origin in your key settings.';
		}

		if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
			return 'Gemini free quota is exhausted. Add an OpenRouter API key to continue instantly with free fallback models, or wait for quota reset in Google AI Studio.';
		}

		if (/404|not found|models\//i.test(message)) {
			if (/OpenRouter/i.test(message)) {
				return 'OpenRouter free-model routing failed for the current candidates. Try again in 1 to 2 minutes or switch to a different OpenRouter key/project.';
			}
			return 'The selected model was not available for your key/project. I tried fallback models as well and all failed.';
		}

		if (/Failed to fetch|NetworkError|network/i.test(message)) {
			return 'Network request failed. Check your internet connection, ad blockers, and browser privacy settings, then try again.';
		}

		return `I could not reach the model. ${message || 'Please check your API key and connection, then try again.'}`;
	}

	function renderMessage(role, text, extraClass = '') {
		const messages = getEl('chatMessages');
		if (!messages) return;

		const wrapper = document.createElement('div');
		wrapper.className = `message ${role === 'user' ? 'user-message' : 'bot-message'} ${extraClass}`.trim();

		wrapper.innerHTML = `
			<div class="message-avatar">
				<i class="fas fa-${role === 'user' ? 'user' : 'robot'}"></i>
			</div>
			<div class="message-content">
				<p>${escapeHtml(text)}</p>
			</div>
		`;

		messages.appendChild(wrapper);
		messages.scrollTop = messages.scrollHeight;
	}

	function renderTypingIndicator() {
		const messages = getEl('chatMessages');
		if (!messages) return null;

		const wrapper = document.createElement('div');
		wrapper.className = 'message bot-message typing-message';
		wrapper.innerHTML = `
			<div class="message-avatar">
				<i class="fas fa-robot"></i>
			</div>
			<div class="message-content">
				<div class="typing-indicator" aria-label="MindCare AI is typing">
					<span class="typing-dot"></span>
					<span class="typing-dot"></span>
					<span class="typing-dot"></span>
				</div>
			</div>
		`;

		messages.appendChild(wrapper);
		messages.scrollTop = messages.scrollHeight;
		return wrapper;
	}

	function persistChat() {
		saveJson(STORAGE_KEYS.chat, chatState.messages);
	}

	function addChatMessage(role, text) {
		chatState.messages.push({ role, text, createdAt: Date.now() });
		persistChat();
		renderMessage(role, text);
	}

	function removeTypingIndicator(indicator) {
		if (indicator && indicator.parentNode) {
			indicator.parentNode.removeChild(indicator);
		}
	}

	async function sendMessage(rawText) {
		const input = rawText.trim();
		if (!input) return;

		addChatMessage('user', input);

		if (isCrisisMessage(input)) {
			const indicator = renderTypingIndicator();
			clearTimeout(chatState.typingTimer);
			chatState.typingTimer = setTimeout(() => {
				removeTypingIndicator(indicator);
				addChatMessage(
					'bot',
					'I am really glad you told me. If you might act on these thoughts right now, call emergency services now. In the U.S. and Canada you can call or text 988. If you are elsewhere, contact local emergency services or a crisis line immediately and stay with someone safe if you can.'
				);
			}, 800);
			return;
		}

		const indicator = renderTypingIndicator();
		try {
			const apiKey = ensureApiKey();
			if (!apiKey) {
				throw new Error('Missing API key.');
			}

			let reply = '';
			try {
				reply = await requestAssistantReply(apiKey);
			} catch (geminiError) {
				if (!isQuotaError(geminiError)) {
					throw geminiError;
				}

				const openRouterApiKey = ensureOpenRouterApiKey();
				if (!openRouterApiKey) {
					throw geminiError;
				}

				reply = await requestOpenRouterReply(openRouterApiKey);
			}

			removeTypingIndicator(indicator);
			addChatMessage('bot', reply);
		} catch (error) {
			removeTypingIndicator(indicator);
			console.error('MindCare AI chat request failed:', error);
			addChatMessage('bot', getFallbackReply(error));
		}
	}

	function restoreChat() {
		chatState.messages = loadJson(STORAGE_KEYS.chat, []);
		const messageList = getEl('chatMessages');
		if (!messageList) return;

		messageList.innerHTML = '';

		if (!chatState.messages.length) {
			renderMessage('bot', "Hello! I'm MindCare AI, your personal mental health support assistant. I'm here to listen without judgment and help you feel better. What's on your mind today?");
			return;
		}

		chatState.messages.forEach((message) => renderMessage(message.role, message.text));
	}

	function populateAffirmation() {
		const affirmationText = getEl('affirmationText');
		if (!affirmationText) return;

		const last = localStorage.getItem(STORAGE_KEYS.affirmation);
		let next = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];

		if (AFFIRMATIONS.length > 1 && next === last) {
			next = AFFIRMATIONS[(AFFIRMATIONS.indexOf(next) + 1) % AFFIRMATIONS.length];
		}

		affirmationText.textContent = next;
		localStorage.setItem(STORAGE_KEYS.affirmation, next);
	}

	function renderMoodButtons() {
		document.querySelectorAll('.mood-btn').forEach((button) => {
			button.classList.toggle('active', button.dataset.mood === moodState.selectedMood);
		});
	}

	function normalizeMoodEntries(entries) {
		const map = new Map();
		entries.forEach((entry) => {
			map.set(entry.date, entry);
		});
		return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
	}

	function getMoodColor(mood) {
		switch (mood) {
			case 'happy':
				return '#43e97b';
			case 'calm':
				return '#4facfe';
			case 'neutral':
				return '#94a3b8';
			case 'sad':
				return '#8e92f6';
			case 'anxious':
				return '#f5576c';
			default:
				return '#667eea';
		}
	}

	function updateMoodStats(entries) {
		const totalEntries = getEl('totalEntries');
		const commonMood = getEl('commonMood');
		if (!totalEntries || !commonMood) return;

		totalEntries.textContent = String(entries.length);

		if (!entries.length) {
			commonMood.textContent = '-';
			return;
		}

		const counts = entries.reduce((accumulator, entry) => {
			accumulator[entry.mood] = (accumulator[entry.mood] || 0) + 1;
			return accumulator;
		}, {});

		const topMood = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0];
		commonMood.textContent = topMood ? topMood.charAt(0).toUpperCase() + topMood.slice(1) : '-';
	}

	function drawMoodChart() {
		const canvas = getEl('moodChart');
		if (!canvas) return;

		const context = canvas.getContext('2d');
		const devicePixelRatio = window.devicePixelRatio || 1;
		const styles = getComputedStyle(document.documentElement);
		const width = canvas.clientWidth || 320;
		const height = 260;

		canvas.width = Math.floor(width * devicePixelRatio);
		canvas.height = Math.floor(height * devicePixelRatio);
		context.scale(devicePixelRatio, devicePixelRatio);
		canvas.style.height = `${height}px`;

		context.clearRect(0, 0, width, height);

		const days = Array.from({ length: 7 }, (_, index) => {
			const date = new Date();
			date.setDate(date.getDate() - (6 - index));
			return todayKey(date);
		});

		const moodValues = { happy: 5, calm: 4, neutral: 3, sad: 2, anxious: 1 };
		const gridColor = styles.getPropertyValue('--border-color').trim() || '#e2e8f0';
		const labelColor = styles.getPropertyValue('--text-secondary').trim() || '#64748b';

		const paddingX = 20;
		const paddingTop = 20;
		const paddingBottom = 36;
		const chartHeight = height - paddingTop - paddingBottom;
		const chartWidth = width - paddingX * 2;
		const slotWidth = chartWidth / days.length;
		const barWidth = Math.max(18, slotWidth - 10);

		context.strokeStyle = gridColor;
		context.lineWidth = 1;
		context.font = '12px Sora, sans-serif';

		for (let i = 0; i <= 5; i += 1) {
			const y = paddingTop + (chartHeight / 5) * i;
			context.beginPath();
			context.moveTo(paddingX, y);
			context.lineTo(width - paddingX, y);
			context.stroke();
		}

		context.textAlign = 'center';
		context.textBaseline = 'top';

		days.forEach((dateKey, index) => {
			const matching = moodState.entries.find((entry) => entry.date === dateKey);
			const x = paddingX + index * slotWidth + (slotWidth - barWidth) / 2;
			const barHeight = matching ? (moodValues[matching.mood] / 5) * (chartHeight - 10) : 0;
			const y = paddingTop + chartHeight - barHeight;

			if (matching) {
				const gradient = context.createLinearGradient(0, y, 0, y + barHeight);
				gradient.addColorStop(0, getMoodColor(matching.mood));
				gradient.addColorStop(1, `${getMoodColor(matching.mood)}CC`);
				context.fillStyle = gradient;
				context.beginPath();
				context.roundRect(x, y, barWidth, barHeight, 10);
				context.fill();
			} else {
				context.fillStyle = `${gridColor}80`;
				context.beginPath();
				context.roundRect(x, paddingTop + chartHeight - 4, barWidth, 4, 10);
				context.fill();
			}

			context.fillStyle = labelColor;
			context.fillText(getDayLabel(dateKey), x + barWidth / 2, height - 24);
		});
	}

	function updateMoodChart() {
		moodState.entries = normalizeMoodEntries(loadJson(STORAGE_KEYS.mood, []));
		updateMoodStats(moodState.entries);
		renderMoodButtons();
		drawMoodChart();
	}

	function saveMood(mood) {
		moodState.selectedMood = mood;
		const date = todayKey();
		const existingIndex = moodState.entries.findIndex((entry) => entry.date === date);
		const entry = { date, mood };

		if (existingIndex >= 0) {
			moodState.entries[existingIndex] = entry;
		} else {
			moodState.entries.push(entry);
		}

		moodState.entries = normalizeMoodEntries(moodState.entries);
		saveJson(STORAGE_KEYS.mood, moodState.entries);
		updateMoodChart();
	}

	function closeModal(modalId) {
		const modal = getEl(modalId);
		if (!modal) return;

		modal.classList.remove('active');
		const content = modal.querySelector(modalId === 'exerciseModal' ? '#exerciseContent' : '#resourceContent');
		if (content) {
			content.innerHTML = '';
		}

		if (exerciseTimer) {
			clearInterval(exerciseTimer);
			exerciseTimer = null;
		}
	}

	function openModal(modalId, contentHtml) {
		const modal = getEl(modalId);
		const content = modal?.querySelector(modalId === 'exerciseModal' ? '#exerciseContent' : '#resourceContent');
		if (!modal || !content) return;

		content.innerHTML = contentHtml;
		modal.classList.add('active');
	}

	function renderResource(resourceKey) {
		const resource = RESOURCE_CONTENT[resourceKey];
		if (!resource) return;

		const steps = resource.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
		openModal(
			'resourceModal',
			`
				<div class="modal-body">
					<h2>${escapeHtml(resource.title)}</h2>
					<p>${escapeHtml(resource.intro)}</p>
					<h3>What helps</h3>
					<ul class="advice-list">
						${steps}
					</ul>
					<p>${escapeHtml(resource.tip)}</p>
				</div>
			`
		);
	}

	function buildBreathingExercise() {
		return `
			<div class="modal-body">
				<h2>4-7-8 Breathing</h2>
				<p>Follow the rhythm below for a few rounds. Keep your shoulders soft.</p>
				<div id="exerciseTimer" style="font-size: 3rem; font-weight: 700; text-align: center; margin: 1.5rem 0; color: var(--primary);">Ready</div>
				<p id="exercisePhase" style="text-align:center; font-size: 1.1rem; margin-bottom: 1rem;">Press start to begin.</p>
				<button class="btn btn-primary" id="startBreathingButton" type="button">Start Exercise</button>
			</div>
		`;
	}

	function runBreathingExercise() {
		const timer = getEl('exerciseTimer');
		const phase = getEl('exercisePhase');
		const startButton = getEl('startBreathingButton');
		if (!timer || !phase || !startButton) return;

		startButton.disabled = true;
		let round = 0;
		let stageIndex = 0;
		const stages = [
			{ label: 'Inhale', seconds: 4 },
			{ label: 'Hold', seconds: 7 },
			{ label: 'Exhale', seconds: 8 },
		];

		const tick = () => {
			const stage = stages[stageIndex % stages.length];
			phase.textContent = `${stage.label} for ${stage.seconds} seconds`;

			let remaining = stage.seconds;
			timer.textContent = String(remaining);

			exerciseTimer = window.setInterval(() => {
				remaining -= 1;
				timer.textContent = String(Math.max(remaining, 0));

				if (remaining <= 0) {
					clearInterval(exerciseTimer);
					exerciseTimer = null;
					stageIndex += 1;

					if (stageIndex >= stages.length * 4) {
						phase.textContent = 'Finished. Notice how your body feels now.';
						timer.textContent = 'Done';
						startButton.disabled = false;
						return;
					}

					if (stageIndex % stages.length === 0) {
						round += 1;
						phase.textContent = `Round ${round} complete. Keep going.`;
					}

					tick();
				}
			}, 1000);
		};

		tick();
	}

	function renderExercise(exerciseKey) {
		const exercise = EXERCISES[exerciseKey];
		if (!exercise) return;

		if (exerciseKey === 'breathing') {
			openModal('exerciseModal', buildBreathingExercise());
			const modal = getEl('exerciseModal');
			const startButton = modal?.querySelector('#startBreathingButton');
			if (startButton) {
				startButton.addEventListener('click', runBreathingExercise, { once: true });
			}
			return;
		}

		const steps = exercise.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
		openModal(
			'exerciseModal',
			`
				<div class="modal-body">
					<h2>${escapeHtml(exercise.title)}</h2>
					<p>${escapeHtml(exercise.intro)}</p>
					<ol class="advice-list">
						${steps}
					</ol>
					<p>Return to this exercise any time you need a reset.</p>
				</div>
			`
		);
	}

	function openSettingsModal() {
		const geminiKey = (getStoredApiKey() || '').slice(-8).padStart(12, '•');
		const openRouterKey = (getStoredOpenRouterApiKey() || '').slice(-8).padStart(12, '•');
		const geminiStatus = getStoredApiKey() ? 'Set' : 'Not set';
		const openRouterStatus = getStoredOpenRouterApiKey() ? 'Set' : 'Not set';

		const modal = document.createElement('div');
		modal.className = 'modal active';
		modal.id = 'settingsModal';
		modal.innerHTML = `
			<div class="modal-content glass-morphism">
				<button class="modal-close" onclick="closeSettingsModal()">
					<i class="fas fa-times"></i>
				</button>
				<div class="modal-body">
					<h2>API Settings</h2>
					<div style="margin: 1.5rem 0;">
						<h3 style="margin-bottom: 0.5rem; font-size: 1rem;">Gemini API Key</h3>
						<p style="font-size: 0.875rem; color: var(--text-tertiary); margin-bottom: 0.5rem;">Status: <strong>${geminiStatus}</strong> ${geminiStatus === 'Set' ? `(${geminiKey})` : ''}</p>
						<input type="password" id="geminiKeyInput" placeholder="Paste your Gemini API key" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-family: monospace; font-size: 0.875rem; margin-bottom: 0.5rem;">
						<div style="display: flex; gap: 0.5rem;">
							<button onclick="saveGeminiKey()" class="btn btn-primary" style="flex: 1; padding: 0.5rem;">Save</button>
							<button onclick="clearGeminiKey()" class="btn-outline" style="flex: 1; padding: 0.5rem;">Clear</button>
						</div>
					</div>

					<div style="margin: 1.5rem 0;">
						<h3 style="margin-bottom: 0.5rem; font-size: 1rem;">OpenRouter API Key (Fallback)</h3>
						<p style="font-size: 0.875rem; color: var(--text-tertiary); margin-bottom: 0.5rem;">Status: <strong>${openRouterStatus}</strong> ${openRouterStatus === 'Set' ? `(${openRouterKey})` : ''}</p>
						<input type="password" id="openRouterKeyInput" placeholder="Paste your OpenRouter API key (optional)" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-family: monospace; font-size: 0.875rem; margin-bottom: 0.5rem;">
						<div style="display: flex; gap: 0.5rem;">
							<button onclick="saveOpenRouterKey()" class="btn btn-primary" style="flex: 1; padding: 0.5rem;">Save</button>
							<button onclick="clearOpenRouterKey()" class="btn-outline" style="flex: 1; padding: 0.5rem;">Clear</button>
						</div>
					</div>

					<p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
						<i class="fas fa-info-circle" style="margin-right: 0.5rem;"></i>
						Keys are stored only in your browser's localStorage and are never sent to any server except the respective API providers.
					</p>
				</div>
			</div>
		`;

		document.body.appendChild(modal);
		modal.querySelector('.modal-close').addEventListener('click', closeSettingsModal);
		modal.addEventListener('click', (e) => {
			if (e.target === modal) closeSettingsModal();
		});
	}

	window.saveGeminiKey = function saveGeminiKey() {
		const input = document.getElementById('geminiKeyInput');
		if (input && input.value.trim()) {
			localStorage.setItem(STORAGE_KEYS.apiKey, input.value.trim());
			alert('Gemini API key saved.');
			openSettingsModal();
		}
	};

	window.saveOpenRouterKey = function saveOpenRouterKey() {
		const input = document.getElementById('openRouterKeyInput');
		if (input && input.value.trim()) {
			localStorage.setItem(STORAGE_KEYS.openRouterApiKey, input.value.trim());
			alert('OpenRouter API key saved.');
			openSettingsModal();
		}
	};

	window.clearGeminiKey = function clearGeminiKey() {
		if (window.confirm('Clear Gemini API key?')) {
			localStorage.removeItem(STORAGE_KEYS.apiKey);
			alert('Gemini API key cleared.');
			openSettingsModal();
		}
	};

	window.clearOpenRouterKey = function clearOpenRouterKey() {
		if (window.confirm('Clear OpenRouter API key?')) {
			localStorage.removeItem(STORAGE_KEYS.openRouterApiKey);
			alert('OpenRouter API key cleared.');
			openSettingsModal();
		}
	};

	window.closeSettingsModal = function closeSettingsModal() {
		const modal = document.getElementById('settingsModal');
		if (modal) {
			modal.remove();
		}
	};

	function attachEvents() {
		const themeToggle = getEl('themeToggle');
		const themeIcon = themeToggle?.querySelector('i');
		const hamburger = getEl('hamburger');
		const navMenu = document.querySelector('.nav-menu');
		const chatForm = getEl('chatForm');
		const chatInput = getEl('chatInput');
		const newAffirmation = getEl('newAffirmation');
		const clearChat = getEl('clearChat');

		themeToggle?.addEventListener('click', () => {
			const currentTheme = document.documentElement.getAttribute('data-theme');
			const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
			document.documentElement.setAttribute('data-theme', nextTheme);
			localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
			if (themeIcon) {
				themeIcon.className = nextTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
			}
		});

		const settingsBtn = document.createElement('button');
		settingsBtn.className = 'btn-icon';
		settingsBtn.id = 'settingsButton';
		settingsBtn.setAttribute('aria-label', 'API Settings');
		settingsBtn.innerHTML = '<i class="fas fa-cog"></i>';
		settingsBtn.addEventListener('click', openSettingsModal);
		const navActions = document.querySelector('.nav-actions');
		if (navActions) {
			navActions.insertBefore(settingsBtn, navActions.firstChild);
		}

		hamburger?.addEventListener('click', () => {
			navMenu?.classList.toggle('active');
		});

		document.querySelectorAll('.nav-link').forEach((link) => {
			link.addEventListener('click', (event) => {
				navMenu?.classList.remove('active');
				const href = event.currentTarget.getAttribute('href');
				if (href && href.startsWith('#')) {
					const section = document.querySelector(href);
					section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			});
		});

		chatForm?.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!chatInput) return;
			const message = chatInput.value;
			chatInput.value = '';
			sendMessage(message);
		});

		newAffirmation?.addEventListener('click', populateAffirmation);

		clearChat?.addEventListener('click', () => {
			chatState.messages = [];
			saveJson(STORAGE_KEYS.chat, []);
			restoreChat();
		});

		document.querySelectorAll('.resource-card').forEach((card) => {
			card.addEventListener('click', () => renderResource(card.dataset.resource || ''));
		});

		document.querySelectorAll('.btn-outline').forEach((button) => {
			button.addEventListener('click', (event) => {
				const resourceCard = event.currentTarget?.closest('.resource-card');
				if (resourceCard?.dataset.resource) {
					renderResource(resourceCard.dataset.resource);
				}
			});
		});

		document.querySelectorAll('.mood-btn').forEach((button) => {
			button.addEventListener('click', () => saveMood(button.dataset.mood || 'neutral'));
		});

		document.querySelectorAll('.exercise-card .btn-exercise').forEach((button) => {
			button.addEventListener('click', (event) => {
				const card = event.currentTarget?.closest('.exercise-card');
				const title = card?.querySelector('h3')?.textContent?.toLowerCase() || '';
				if (title.includes('breathing')) {
					renderExercise('breathing');
				} else if (title.includes('muscle')) {
					renderExercise('muscle');
				} else {
					renderExercise('meditation');
				}
			});
		});

		document.addEventListener('click', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;

			if (target.classList.contains('modal')) {
				closeExercise();
				closeResource();
			}
		});

		window.addEventListener('resize', drawMoodChart);
	}

	function initializeTheme() {
		const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
		const theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
		document.documentElement.setAttribute('data-theme', theme);

		const themeIcon = getEl('themeToggle')?.querySelector('i');
		if (themeIcon) {
			themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
		}
	}

	function initializeApp() {
		initializeTheme();
		restoreChat();
		populateAffirmation();
		updateMoodChart();
		attachEvents();
		if (!getStoredApiKey()) {
			const apiNote = 'Add your Gemini API key to start the real chatbot. The key is stored locally in this browser.';
			console.info(apiNote);
		}
	}

	window.sendPrompt = function sendPrompt(promptText) {
		sendMessage(promptText);
	};

	window.startExercise = function startExercise(exerciseType) {
		renderExercise(exerciseType);
	};

	window.closeExercise = function closeExercise() {
		closeModal('exerciseModal');
	};

	window.closeResource = function closeResource() {
		closeModal('resourceModal');
	};

	document.addEventListener('DOMContentLoaded', initializeApp);
})();

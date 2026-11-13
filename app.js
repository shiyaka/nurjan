/**
 * Lumen · 轻量信息流
 * 纯前端实现，数据保存在 localStorage 中。
 * 结构：store（数据层）→ view（渲染层）→ controller（交互层）
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'stream.posts.v1';
  var MAX_LENGTH = 280;
  var DELETE_CONFIRM_TIMEOUT = 3200;

  /* ============================================================
     store：localStorage 读写与数据结构约束
     ============================================================ */
  var store = {
    /**
     * 读取全部内容，倒序（新→旧）。
     * 任何异常、脏数据都被安全忽略，绝不抛出到上层。
     */
    load: function () {
      var raw;
      try {
        raw = window.localStorage.getItem(STORAGE_KEY);
      } catch (error) {
        console.warn('[lumen] 无法访问本地存储，本次会话不会持久化。', error);
        return [];
      }

      if (!raw) return [];

      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        console.warn('[lumen] 本地数据解析失败，已回退为空列表。', error);
        return [];
      }

      if (!Array.isArray(parsed)) return [];

      var posts = [];
      for (var i = 0; i < parsed.length; i += 1) {
        var item = parsed[i];
        if (!item || typeof item !== 'object') continue;
        if (typeof item.content !== 'string') continue;

        var content = item.content;
        if (!content.trim()) continue;

        var createdAt = Number(item.createdAt);
        if (!isFinite(createdAt) || createdAt <= 0) createdAt = Date.now();

        posts.push({
          id: typeof item.id === 'string' && item.id ? item.id : createId(),
          content: content.slice(0, MAX_LENGTH),
          author: typeof item.author === 'string' && item.author ? item.author : '我',
          createdAt: createdAt
        });
      }

      posts.sort(function (a, b) {
        return b.createdAt - a.createdAt;
      });

      return posts;
    },

    /** 写入全部内容；失败时返回 false，由调用方给出提示。 */
    save: function (posts) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
        return true;
      } catch (error) {
        console.warn('[lumen] 本地数据写入失败（可能已超出容量限制）。', error);
        return false;
      }
    }
  };

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ============================================================
     view：渲染与格式化
     ============================================================ */
  var els = {
    form: document.getElementById('composer-form'),
    input: document.getElementById('composer-input'),
    counter: document.getElementById('composer-counter'),
    counterValue: document.getElementById('counter-value'),
    publishBtn: document.getElementById('publish-btn'),
    feed: document.getElementById('feed'),
    emptyState: document.getElementById('empty-state'),
    postCount: document.getElementById('post-count'),
    template: document.getElementById('post-template'),
    toast: document.getElementById('toast')
  };

  /**
   * 相对时间：刚刚 / n 分钟前 / n 小时前 / 昨天 HH:mm / M月D日（跨年补年份）
   */
  function formatRelativeTime(timestamp) {
    var now = Date.now();
    var diff = now - timestamp;
    var date = new Date(timestamp);

    if (diff < 0) diff = 0;

    var minute = 60 * 1000;
    var hour = 60 * minute;

    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + ' 分钟前';

    if (isSameDay(date, new Date(now))) {
      return Math.floor(diff / hour) + ' 小时前';
    }

    var yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(date, yesterday)) {
      return '昨天 ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    }

    var sameYear = date.getFullYear() === new Date(now).getFullYear();
    var monthDay = date.getMonth() + 1 + '月' + date.getDate() + '日';
    return sameYear ? monthDay : date.getFullYear() + '年' + monthDay;
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function createPostNode(post, index) {
    var node = els.template.content.firstElementChild.cloneNode(true);
    var time = node.querySelector('.post__time');
    var content = node.querySelector('.post__content');
    var deleteBtn = node.querySelector('.post__delete');
    var avatar = node.querySelector('.post__avatar');
    var author = node.querySelector('.post__author');

    node.dataset.id = post.id;
    author.textContent = post.author;
    avatar.textContent = post.author.slice(0, 1);

    // 使用 textContent 注入用户内容，避免 XSS
    content.textContent = post.content;
    time.textContent = formatRelativeTime(post.createdAt);
    time.setAttribute('datetime', new Date(post.createdAt).toISOString());
    time.title = new Date(post.createdAt).toLocaleString('zh-CN');
    deleteBtn.dataset.id = post.id;

    // 错峰入场动画，最多延迟 240ms，避免长列表等待
    node.classList.add('post--enter');
    node.style.animationDelay = Math.min(index * 40, 240) + 'ms';
    node.addEventListener(
      'animationend',
      function () {
        node.classList.remove('post--enter');
        node.style.animationDelay = '';
      },
      { once: true }
    );

    return node;
  }

  function renderFeed(posts, animateNew) {
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < posts.length; i += 1) {
      fragment.appendChild(createPostNode(posts[i], animateNew ? 0 : i));
    }

    els.feed.replaceChildren(fragment);

    var isEmpty = posts.length === 0;
    els.emptyState.hidden = !isEmpty;
    els.postCount.hidden = isEmpty;
    els.postCount.textContent = posts.length + ' 条';
  }

  var toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 2000);
  }

  /* ============================================================
     controller：状态与交互
     ============================================================ */
  var posts = store.load();

  function refresh(animateNew) {
    renderFeed(posts, Boolean(animateNew));
  }

  function updateComposerState() {
    var length = els.input.value.length;
    els.counterValue.textContent = String(length);

    els.counter.classList.toggle('is-near-limit', length >= MAX_LENGTH * 0.9 && length < MAX_LENGTH);
    els.counter.classList.toggle('is-over-limit', length >= MAX_LENGTH);

    els.publishBtn.disabled = els.input.value.trim().length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();

    var content = els.input.value.trim();
    if (!content) {
      els.input.focus();
      return;
    }

    var post = {
      id: createId(),
      content: content.slice(0, MAX_LENGTH),
      author: '我',
      createdAt: Date.now()
    };

    posts.unshift(post);

    if (!store.save(posts)) {
      posts.shift();
      showToast('保存失败：本地存储空间可能已满');
      return;
    }

    els.input.value = '';
    updateComposerState();
    refresh(true);
    showToast('已发布，仅保存在本机');
    els.input.focus();
  }

  var confirmingId = null;
  var confirmTimer = null;

  function resetDeleteButton() {
    if (!confirmingId) return;
    var btn = els.feed.querySelector('.post__delete[data-id="' + cssEscape(confirmingId) + '"]');
    if (btn) {
      btn.classList.remove('is-confirming');
      btn.textContent = '删除';
      btn.setAttribute('aria-label', '删除这条内容');
    }
    confirmingId = null;
    window.clearTimeout(confirmTimer);
    confirmTimer = null;
  }

  function handleFeedClick(event) {
    var btn = event.target.closest('.post__delete');
    if (!btn) return;

    var id = btn.dataset.id;
    if (!id) return;

    // 第一段确认：按钮就地切换为「确认删除」
    if (confirmingId !== id) {
      resetDeleteButton();
      confirmingId = id;
      btn.classList.add('is-confirming');
      btn.textContent = '确认删除';
      btn.setAttribute('aria-label', '再次点击确认删除');
      confirmTimer = window.setTimeout(resetDeleteButton, DELETE_CONFIRM_TIMEOUT);
      return;
    }

    // 第二段确认：执行删除
    resetDeleteButton();

    var card = btn.closest('.post');
    var target = posts.filter(function (item) {
      return item.id === id;
    })[0];

    posts = posts.filter(function (item) {
      return item.id !== id;
    });

    if (!store.save(posts)) {
      if (target) posts.unshift(target);
      posts.sort(function (a, b) {
        return b.createdAt - a.createdAt;
      });
      showToast('删除失败，请稍后重试');
      refresh(false);
      return;
    }

    if (card) {
      card.classList.add('post--leave');
      window.setTimeout(function () {
        refresh(false);
      }, 180);
    } else {
      refresh(false);
    }

    showToast('已删除');
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function bindEvents() {
    els.form.addEventListener('submit', handleSubmit);
    els.input.addEventListener('input', updateComposerState);
    els.feed.addEventListener('click', handleFeedClick);

    els.input.addEventListener('keydown', function (event) {
      // Ctrl / Cmd + Enter 快捷发布
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!els.publishBtn.disabled) {
          els.form.requestSubmit ? els.form.requestSubmit() : els.form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      }
    });

    // 点击列表外区域时取消未完成的删除确认
    document.addEventListener('click', function (event) {
      if (!confirmingId) return;
      if (!event.target.closest || !event.target.closest('.post__delete')) {
        resetDeleteButton();
      }
    });

    // 跨标签页同步
    window.addEventListener('storage', function (event) {
      if (event.key !== STORAGE_KEY) return;
      posts = store.load();
      refresh(false);
    });
  }

  function init() {
    updateComposerState();
    refresh(false);
    bindEvents();
  }

  init();
})();

"use strict";

(() => {
    // 只保存主题和经用户同意的留言；隐私模式禁用存储时保持页面可用。
    const storage = {
        read(key, fallback) {
            try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
            catch { return fallback; }
        },
        write(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; }
            catch { return false; }
        }
    };
    const menuButton = document.querySelector(".menu-toggle");
    const navigation = document.querySelector("#primary-nav");
    const setMenu = (open) => {
        navigation.classList.toggle("is-open", open);
        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.setAttribute("aria-label", open ? "收起导航" : "展开导航");
    };
    menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("click", (event) => {
        if (!event.target.closest(".nav-shell")) setMenu(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setMenu(false);
    });
    window.matchMedia("(max-width: 768px)").addEventListener("change", () => setMenu(false));

    const themeButton = document.querySelector(".theme-toggle");
    const setTheme = (theme) => {
        document.body.dataset.theme = theme;
        themeButton.setAttribute("aria-pressed", String(theme === "dark"));
        themeButton.setAttribute("aria-label", theme === "dark" ? "切换浅色模式" : "切换深色模式");
    };
    setTheme(storage.read("fengqi-theme", "light"));
    themeButton.addEventListener("click", () => {
        const theme = document.body.dataset.theme === "dark" ? "light" : "dark";
        setTheme(theme);
        storage.write("fengqi-theme", theme);
    });

    const searchDialog = document.querySelector("#search-dialog");
    let searchTrigger = null;
    document.querySelector("[data-open-search]").addEventListener("click", (event) => {
        searchTrigger = event.currentTarget;
        setMenu(false);
        searchDialog.showModal();
        document.querySelector("#global-query").focus();
    });
    document.querySelector("[data-close-search]").addEventListener("click", () => searchDialog.close());
    searchDialog.addEventListener("close", () => searchTrigger?.focus());
    searchDialog.addEventListener("click", (event) => {
        if (event.target === searchDialog) {
            const bounds = searchDialog.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) searchDialog.close();
        }
    });

    const topButton = document.querySelector(".back-to-top");
    const refreshTopButton = () => { topButton.hidden = window.scrollY < 480; };
    window.addEventListener("scroll", refreshTopButton, { passive: true });
    refreshTopButton();
    topButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));

    // 分类、关键词和分页共同作用；切换条件时从第一页开始，避免出现假空状态。
    const articleList = document.querySelector("[data-article-list]");
    if (articleList) {
        const cards = [...articleList.querySelectorAll(".post-card")];
        const filterButtons = [...articleList.querySelectorAll("[data-filter]")];
        const searchInput = document.querySelector("#article-query");
        const moreButton = document.querySelector("#load-more");
        let category = "全部";
        let limit = 2;
        searchInput.value = new URLSearchParams(location.search).get("q")?.slice(0, 80) || "";
        const update = () => {
            const query = searchInput.value.trim().toLocaleLowerCase();
            const matches = cards.filter((card) => (category === "全部" || card.dataset.category === category) && card.dataset.search.toLocaleLowerCase().includes(query));
            cards.forEach((card) => { card.hidden = !matches.slice(0, limit).includes(card); });
            filterButtons.forEach((button) => {
                const selected = button.dataset.filter === category;
                button.classList.toggle("active", selected);
                button.setAttribute("aria-pressed", String(selected));
            });
            articleList.querySelector(".result-summary").textContent = `共 ${matches.length} 篇文章 · 按最新发布排序${query ? ` · 关键词“${searchInput.value.trim()}”` : ""}`;
            articleList.querySelector(".empty-state").hidden = matches.length > 0;
            moreButton.hidden = matches.length <= limit;
            document.querySelector("#list-end").hidden = matches.length === 0 || matches.length > limit;
        };
        filterButtons.forEach((button) => button.addEventListener("click", () => { category = button.dataset.filter; limit = 2; update(); }));
        searchInput.addEventListener("input", () => { limit = 2; update(); });
        articleList.querySelector(".list-search").addEventListener("submit", (event) => { event.preventDefault(); limit = 2; update(); });
        moreButton.addEventListener("click", () => { limit += 2; update(); });
        articleList.querySelector("[data-reset-filters]").addEventListener("click", () => { category = "全部"; searchInput.value = ""; limit = 2; update(); searchInput.focus(); });
        update();
    }

    // 灯箱使用原生 dialog，保留 Esc 关闭与焦点返回。
    const lightbox = document.querySelector("#lightbox");
    if (lightbox) {
        let trigger = null;
        document.querySelectorAll("[data-lightbox]").forEach((button) => button.addEventListener("click", () => {
            trigger = button;
            const source = button.querySelector("img");
            const largeImage = lightbox.querySelector("img");
            largeImage.src = source.src;
            largeImage.alt = source.alt;
            lightbox.querySelector("p").textContent = source.alt;
            lightbox.showModal();
        }));
        lightbox.querySelector("[data-close-lightbox]").addEventListener("click", () => lightbox.close());
        lightbox.addEventListener("close", () => trigger?.focus());
    }

    const form = document.querySelector("#contact-form");
    if (form) {
        const fieldNames = ["nickname", "email", "message", "consent"];
        const message = document.querySelector("#message");
        const status = document.querySelector("#form-status");
        const savedSection = document.querySelector("#saved-notes");
        const savedList = document.querySelector("#saved-note-list");
        const submitButton = form.querySelector("[type=submit]");
        let submitting = false;
        let notes = storage.read("fengqi-notes", []);
        if (!Array.isArray(notes)) notes = [];
        notes = notes.filter((note) => note && typeof note.name === "string" && typeof note.message === "string" && typeof note.date === "string").slice(0, 20);
        const chosenTopic = new URLSearchParams(location.search).get("topic");
        if (["daily", "blog", "friend", "other"].includes(chosenTopic)) form.elements.topic.value = chosenTopic;
        const validate = (name) => {
            const field = form.elements[name];
            const value = field.value.trim();
            let error = "";
            if (name === "nickname" && !value) error = "请先填写你的昵称。";
            if (name === "nickname" && value.length > 20) error = "昵称请控制在 20 个字以内。";
            if (name === "email" && !value) error = "请填写电子邮箱，用于格式校验。";
            else if (name === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || field.validity.typeMismatch)) error = "邮箱格式不正确，例如 name@example.com。";
            if (name === "message" && value.length < 5) error = "请至少写下 5 个字，再保存留言。";
            if (name === "message" && value.length > 500) error = "留言最多 500 个字。";
            if (name === "consent" && !field.checked) error = "请先确认同意在当前浏览器保存留言。";
            field.setAttribute("aria-invalid", String(Boolean(error)));
            document.querySelector(`#${name}-error`).textContent = error;
            return !error;
        };
        fieldNames.forEach((name) => {
            form.elements[name].addEventListener("blur", () => validate(name));
            form.elements[name].addEventListener(name === "consent" ? "change" : "input", () => {
                if (form.elements[name].getAttribute("aria-invalid") === "true") validate(name);
                status.textContent = "";
            });
        });
        message.addEventListener("input", () => { document.querySelector("#message-counter").textContent = `${message.value.length} / 500`; });
        const renderNotes = () => {
            savedList.replaceChildren();
            savedSection.hidden = notes.length === 0;
            notes.forEach((note) => {
                const article = document.createElement("article");
                article.className = "saved-note";
                const heading = document.createElement("h3");
                heading.textContent = note.name;
                const date = document.createElement("p");
                date.className = "muted small";
                date.textContent = note.date;
                const body = document.createElement("p");
                // 使用 textContent，不把访客输入作为 HTML 执行。
                body.textContent = note.message;
                article.append(heading, date, body);
                savedList.append(article);
            });
        };
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            if (submitting) return;
            const valid = fieldNames.map(validate);
            if (valid.some((value) => !value)) {
                status.textContent = "请检查标出的内容，再保存。";
                form.elements[fieldNames[valid.indexOf(false)]].focus();
                return;
            }
            submitting = true;
            submitButton.disabled = true;
            const note = { name: form.elements.nickname.value.trim(), message: message.value.trim(), date: new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Hong_Kong" }).format(new Date()) };
            const nextNotes = [note, ...notes].slice(0, 20);
            if (storage.write("fengqi-notes", nextNotes)) {
                notes = nextNotes;
                renderNotes();
                form.reset();
                document.querySelector("#message-counter").textContent = "0 / 500";
                fieldNames.forEach((name) => form.elements[name].removeAttribute("aria-invalid"));
                status.textContent = "留言已保存在这个浏览器中。谢谢你留下这段文字！";
            } else status.textContent = "浏览器阻止了本地存储，留言未保存。请允许存储后重试，文字仍保留在表单里。";
            submitting = false;
            submitButton.disabled = false;
        });
        document.querySelector("#clear-notes").addEventListener("click", () => {
            if (storage.write("fengqi-notes", [])) { notes = []; renderNotes(); status.textContent = "本地留言已清除。"; }
            else status.textContent = "浏览器阻止了操作，无法清除本地留言。";
        });
        renderNotes();
    }

    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) { entry.target.classList.add("is-observed"); observer.unobserve(entry.target); }
            });
        }, { threshold: .08 });
        document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    }
})();

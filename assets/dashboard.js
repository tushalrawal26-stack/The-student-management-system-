(function () {
    "use strict";

    var STORAGE_KEY = "daylight-dashboard-v1";
    var THEME_KEY = "daylight-dashboard-theme";
    var page = document.body.getAttribute("data-page");
    var notice = document.getElementById("notice");
    var themeButton = document.getElementById("theme-toggle");
    var installButton = document.getElementById("install-app");
    var money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    var installPrompt = null;

    function applyTheme(theme, persist) {
        var dark = theme === "dark";
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        var icon = document.getElementById("theme-icon");
        var label = document.getElementById("theme-label");
        if (icon) icon.textContent = dark ? "☀" : "☾";
        if (label) label.textContent = dark ? "Light mode" : "Dark mode";
        if (themeButton) {
            themeButton.setAttribute("aria-label", "Switch to " + (dark ? "light" : "dark") + " mode");
            themeButton.setAttribute("aria-pressed", dark ? "true" : "false");
        }
        if (persist) {
            try {
                localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
                notice.textContent = "";
            } catch (error) {
                notice.textContent = "The theme changed, but couldn't be saved in this browser.";
            }
        }
    }

    var savedTheme = "light";
    try {
        savedTheme = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch (error) {
        notice.textContent = "Your theme preference couldn't be loaded in this browser.";
    }
    applyTheme(savedTheme, false);
    if (themeButton) {
        themeButton.addEventListener("click", function () {
            var nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            applyTheme(nextTheme, true);
        });
    }
    if (installButton) {
        window.addEventListener("beforeinstallprompt", function (event) {
            event.preventDefault();
            installPrompt = event;
            installButton.hidden = false;
        });
        installButton.addEventListener("click", function () {
            if (!installPrompt) return;
            installPrompt.prompt();
            installPrompt.userChoice.then(function (choice) {
                installPrompt = null;
                installButton.hidden = true;
                if (choice.outcome === "accepted") notice.textContent = "JARVIS has been installed on this device.";
            }).catch(function (error) {
                console.error("JARVIS installation could not be completed:", error);
                notice.textContent = "JARVIS couldn't be installed. Try the browser's install option instead.";
            });
        });
        window.addEventListener("appinstalled", function () {
            installPrompt = null;
            installButton.hidden = true;
            notice.textContent = "JARVIS has been installed on this device.";
        });
    }

    function loadData() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            var parsed = stored ? JSON.parse(stored) : {};
            return {
                expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
                sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
                todos: Array.isArray(parsed.todos) ? parsed.todos : [],
                timerStartedAt: typeof parsed.timerStartedAt === "number" ? parsed.timerStartedAt : null
            };
        } catch (error) {
            notice.textContent = "Your saved data could not be read. You can still use the dashboard, but changes may not be saved.";
            return { expenses: [], sessions: [], todos: [], timerStartedAt: null };
        }
    }

    var data = loadData();

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            notice.textContent = "";
            return true;
        } catch (error) {
            notice.textContent = "Couldn't save your changes. Check that browser storage is available.";
            return false;
        }
    }

    function makeId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function localDate(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, "0");
        var day = String(date.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function weekDates() {
        var now = new Date();
        var mondayOffset = (now.getDay() + 6) % 7;
        var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
        return Array.from({ length: 7 }, function (_, index) {
            var date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
            return { date: localDate(date), label: date.toLocaleDateString(undefined, { weekday: "short" }) };
        });
    }

    function isThisMonth(dateString) {
        var date = new Date(dateString + "T12:00:00");
        var now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }

    function sessionDurationSeconds(session) {
        if (typeof session.seconds === "number" && Number.isFinite(session.seconds) && session.seconds >= 0) {
            return session.seconds;
        }
        var minutes = typeof session.minutes === "number" && Number.isFinite(session.minutes)
            ? Math.max(0, session.minutes)
            : 0;
        return minutes * 60;
    }

    function formatStudyDuration(seconds) {
        var totalSeconds = Math.max(0, Math.floor(seconds));
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor(totalSeconds % 3600 / 60);
        var remainingSeconds = totalSeconds % 60;
        if (!totalSeconds) return "0m";
        if (hours) return hours + "h" + (minutes ? " " + minutes + "m" : "");
        if (minutes) return minutes + "m" + (remainingSeconds ? " " + remainingSeconds + "s" : "");
        return totalSeconds + "s";
    }

    function renderChart(container, days, values, isExpense) {
        container.replaceChildren();
        var max = Math.max.apply(null, values.concat([0]));
        days.forEach(function (day, index) {
            var group = el("div", "bar-group");
            var valueText = isExpense
                ? (values[index] ? money.format(values[index]) : "")
                : (values[index] ? (values[index] < 0.1 ? "<0.1h" : Math.round(values[index] * 10) / 10 + "h") : "");
            group.appendChild(el("span", "bar-value", valueText));
            var bar = el("div", "bar" + (isExpense ? " expense" : "") + (day.date === localDate(new Date()) ? " today" : ""));
            bar.style.height = (values[index] === 0 ? 2 : Math.max(8, values[index] / (max || 1) * 100)) + "%";
            group.appendChild(bar);
            group.appendChild(el("span", "bar-label", day.label));
            container.appendChild(group);
        });
    }

    function rowButton(label, action) {
        var button = el("button", "delete-button", "×");
        button.type = "button";
        button.setAttribute("aria-label", label);
        button.addEventListener("click", action);
        return button;
    }

    function renderExpenses(limit) {
        var expenseList = document.getElementById("expense-list");
        if (expenseList) {
            expenseList.replaceChildren();
            var expenses = data.expenses.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
            if (limit) expenses = expenses.slice(0, limit);
            if (!expenses.length) expenseList.appendChild(el("div", "empty", "Your expenses will show up here."));
            expenses.forEach(function (item) {
                var row = el("div", "list-row");
                row.appendChild(el("span", "row-icon", item.category === "Food" ? "☕" : item.category === "Travel" ? "↗" : item.category === "Study" ? "▤" : "◦"));
                var content = el("div", "row-content");
                content.appendChild(el("div", "row-title", item.name));
                content.appendChild(el("div", "row-sub", item.category + " · " + item.date));
                row.appendChild(content);
                row.appendChild(el("span", "row-amount", money.format(item.amount)));
                row.appendChild(rowButton("Delete " + item.name, function () {
                    data.expenses = data.expenses.filter(function (expense) { return expense.id !== item.id; });
                    saveData();
                    render();
                }));
                expenseList.appendChild(row);
            });
        }

        var monthExpenses = data.expenses.filter(function (item) { return isThisMonth(item.date); });
        var monthTotal = monthExpenses.reduce(function (sum, item) { return sum + item.amount; }, 0);
        var monthValue = document.getElementById("month-spent");
        if (monthValue) monthValue.textContent = money.format(monthTotal);
        var count = document.getElementById("expense-count");
        if (count) count.textContent = monthExpenses.length + (monthExpenses.length === 1 ? " expense this month" : " expenses this month");

        var categories = {};
        monthExpenses.forEach(function (item) { categories[item.category] = (categories[item.category] || 0) + item.amount; });
        var categoryList = document.getElementById("category-list");
        if (categoryList) {
            categoryList.replaceChildren();
            var sortedCategories = Object.keys(categories).sort(function (a, b) { return categories[b] - categories[a]; });
            var categoryStyles = {
                Food: { icon: "☕", className: "food" },
                Travel: { icon: "↗", className: "travel" },
                Study: { icon: "▤", className: "study" },
                Shopping: { icon: "◇", className: "shopping" },
                Other: { icon: "◦", className: "other" }
            };
            if (!sortedCategories.length) categoryList.appendChild(el("div", "empty", "Add expenses to see your spending breakdown."));
            sortedCategories.forEach(function (category) {
                var style = categoryStyles[category] || categoryStyles.Other;
                var share = monthTotal > 0 ? Math.round(categories[category] / monthTotal * 100) : 0;
                var row = el("div", "list-row category-row");
                row.appendChild(el("span", "category-icon " + style.className, style.icon));
                var details = el("div", "category-details");
                details.appendChild(el("div", "row-title", category));
                var meter = el("div", "category-meter");
                meter.setAttribute("role", "img");
                meter.setAttribute("aria-label", category + " makes up " + share + "% of this month's expenses");
                var fill = el("span", "category-meter-fill " + style.className);
                fill.style.width = share + "%";
                meter.appendChild(fill);
                details.appendChild(meter);
                row.appendChild(details);
                var total = el("div", "category-total");
                total.appendChild(el("span", "row-amount", money.format(categories[category])));
                total.appendChild(el("span", "category-share", share + "% of total"));
                row.appendChild(total);
                categoryList.appendChild(row);
            });
        }

        var days = weekDates();
        var chart = document.getElementById("expense-chart");
        if (chart) {
            var expenseByDay = days.map(function (day) {
                return data.expenses.filter(function (expense) { return expense.date === day.date; })
                    .reduce(function (sum, expense) { return sum + expense.amount; }, 0);
            });
            renderChart(chart, days, expenseByDay, true);
        }
    }

    function renderSessions(limit) {
        var studyList = document.getElementById("study-list");
        if (studyList) {
            studyList.replaceChildren();
            var sessions = data.sessions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
            if (limit) sessions = sessions.slice(0, limit);
            sessions.forEach(function (session) {
                var row = el("div", "list-row");
                row.appendChild(el("span", "row-icon", "▤"));
                var content = el("div", "row-content");
                content.appendChild(el("div", "row-title", session.subject));
                content.appendChild(el("div", "row-sub", session.date));
                row.appendChild(content);
                row.appendChild(el("span", "row-amount", formatStudyDuration(sessionDurationSeconds(session))));
                row.appendChild(rowButton("Delete study session for " + session.subject, function () {
                    data.sessions = data.sessions.filter(function (item) { return item.id !== session.id; });
                    saveData();
                    render();
                }));
                studyList.appendChild(row);
            });
            if (!studyList.children.length) studyList.appendChild(el("div", "empty", "Your study sessions will show up here."));
        }

        var days = weekDates();
        var weekSessions = data.sessions.filter(function (session) {
            return days.some(function (day) { return day.date === session.date; });
        });
        var weekSeconds = weekSessions.reduce(function (sum, session) {
            return sum + sessionDurationSeconds(session);
        }, 0);
        var studyValue = document.getElementById("week-study");
        if (studyValue) studyValue.textContent = formatStudyDuration(weekSeconds);
        var studyHint = document.getElementById("study-hint");
        if (studyHint) studyHint.textContent = weekSeconds ? "You've made time to learn this week" : "Add your first study session";
        var sessionCount = document.getElementById("session-count");
        if (sessionCount) sessionCount.textContent = weekSessions.length;
        var chart = document.getElementById("study-chart");
        if (chart) {
            var studyByDay = days.map(function (day) {
                return Math.round(data.sessions.filter(function (session) { return session.date === day.date; })
                    .reduce(function (sum, session) { return sum + sessionDurationSeconds(session); }, 0) / 3600 * 100) / 100;
            });
            renderChart(chart, days, studyByDay, false);
        }
    }

    function renderTodos() {
        var todoList = document.getElementById("todo-list");
        if (todoList) {
            todoList.replaceChildren();
            data.todos.forEach(function (todo) {
                var row = el("div", "list-row" + (todo.done ? " todo-done" : ""));
                var checkbox = el("input", "todo-check");
                checkbox.type = "checkbox";
                checkbox.checked = todo.done;
                checkbox.setAttribute("aria-label", "Mark " + todo.title + " as " + (todo.done ? "not done" : "done"));
                checkbox.addEventListener("change", function () {
                    todo.done = checkbox.checked;
                    saveData();
                    render();
                });
                row.appendChild(checkbox);
                row.appendChild(el("span", "todo-icon", "✓"));
                row.appendChild(el("div", "row-content row-title", todo.title));
                row.appendChild(rowButton("Delete task " + todo.title, function () {
                    data.todos = data.todos.filter(function (item) { return item.id !== todo.id; });
                    saveData();
                    render();
                }));
                todoList.appendChild(row);
            });
            if (!todoList.children.length) todoList.appendChild(el("div", "empty", "Add something you'd like to get done."));
        }

        var incomplete = data.todos.filter(function (todo) { return !todo.done; }).length;
        var remaining = document.getElementById("tasks-left");
        if (remaining) remaining.textContent = incomplete;
        var hint = document.getElementById("tasks-hint");
        if (hint) hint.textContent = data.todos.length ? (data.todos.length - incomplete) + " of " + data.todos.length + " completed" : "Nothing on your list yet";
        var total = document.getElementById("todo-total");
        if (total) total.textContent = data.todos.length + (data.todos.length === 1 ? " task on your list" : " tasks on your list");
    }

    function render() {
        updateDateTime();
        renderExpenses(page === "expenses" ? 0 : 4);
        renderSessions(page === "study" ? 0 : 3);
        renderTodos();
    }

    function updateDateTime() {
        var date = document.getElementById("today-date");
        var time = document.getElementById("today-time");
        var now = new Date();
        if (date) date.textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        if (time) {
            time.textContent = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
            time.setAttribute("datetime", now.toISOString());
        }
    }

    var pendingSessionSeconds = null;

    function updateTimer() {
        var timerValue = document.getElementById("timer-value");
        if (!timerValue) return;
        var label = document.getElementById("timer-label");
        var button = document.getElementById("timer-button");
        var cancelButton = document.getElementById("cancel-timer");
        if (!data.timerStartedAt) {
            timerValue.textContent = "00:00:00";
            label.textContent = "Ready when you are";
            button.textContent = "Start studying";
            if (cancelButton) cancelButton.disabled = true;
            return;
        }
        if (cancelButton) cancelButton.disabled = false;
        var elapsed = pendingSessionSeconds === null
            ? Math.floor((Date.now() - data.timerStartedAt) / 1000)
            : pendingSessionSeconds;
        var hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
        var minutes = String(Math.floor(elapsed % 3600 / 60)).padStart(2, "0");
        var seconds = String(elapsed % 60).padStart(2, "0");
        timerValue.textContent = hours + ":" + minutes + ":" + seconds;
        label.textContent = "Focus session in progress";
        button.textContent = "Finish session";
    }

    function bindForms() {
        var expenseForm = document.getElementById("expense-form");
        if (expenseForm) {
            var dateField = document.getElementById("expense-date");
            dateField.value = localDate(new Date());
            expenseForm.addEventListener("submit", function (event) {
                event.preventDefault();
                var name = document.getElementById("expense-name").value.trim();
                var amount = Number(document.getElementById("expense-amount").value);
                var date = dateField.value;
                if (!name || !Number.isFinite(amount) || amount <= 0 || !date) return;
                data.expenses.push({ id: makeId(), name: name, amount: amount, category: document.getElementById("expense-category").value, date: date });
                if (saveData()) {
                    this.reset();
                    dateField.value = localDate(new Date());
                    render();
                }
            });
        }

        var studyForm = document.getElementById("study-form");
        if (studyForm) {
            studyForm.addEventListener("submit", function (event) {
                event.preventDefault();
                var subject = document.getElementById("study-subject").value.trim();
                var minutes = Number(document.getElementById("study-minutes").value);
                if (!subject || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return;
                data.sessions.push({ id: makeId(), subject: subject, minutes: minutes, seconds: minutes * 60, date: localDate(new Date()) });
                if (saveData()) { this.reset(); render(); }
            });
        }

        var todoForm = document.getElementById("todo-form");
        if (todoForm) {
            todoForm.addEventListener("submit", function (event) {
                event.preventDefault();
                var title = document.getElementById("todo-title").value.trim();
                if (!title) return;
                data.todos.unshift({ id: makeId(), title: title, done: false });
                if (saveData()) { this.reset(); render(); }
            });
        }
    }

    var timerInterval;
    function bindTimer() {
        var button = document.getElementById("timer-button");
        var dialog = document.getElementById("session-dialog");
        var sessionForm = document.getElementById("session-form");
        var subjectInput = document.getElementById("session-subject");
        var durationText = document.getElementById("session-duration");
        var cancelButton = document.getElementById("cancel-session");
        var cancelTimerButton = document.getElementById("cancel-timer");
        if (!button || !dialog || !sessionForm || !subjectInput || !durationText || !cancelButton || !cancelTimerButton) return;

        button.addEventListener("click", function () {
            if (!data.timerStartedAt) {
                data.timerStartedAt = Date.now();
                if (saveData()) updateTimer();
                return;
            }
            pendingSessionSeconds = Math.max(1, Math.floor((Date.now() - data.timerStartedAt) / 1000));
            durationText.textContent = "You focused for " + formatStudyDuration(pendingSessionSeconds) + ". Add a subject to save this session.";
            subjectInput.value = "";
            dialog.showModal();
            updateTimer();
            subjectInput.focus();
        });
        cancelTimerButton.addEventListener("click", function () {
            if (!data.timerStartedAt) return;
            var startedAt = data.timerStartedAt;
            data.timerStartedAt = null;
            pendingSessionSeconds = null;
            if (saveData()) {
                updateTimer();
                notice.textContent = "Study session cancelled. Its time wasn't saved.";
            } else {
                data.timerStartedAt = startedAt;
                updateTimer();
            }
        });
        cancelButton.addEventListener("click", function () { dialog.close(); });
        dialog.addEventListener("close", function () {
            pendingSessionSeconds = null;
            updateTimer();
        });
        sessionForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var subject = subjectInput.value.trim();
            if (!subject || pendingSessionSeconds === null) return;

            var startedAt = data.timerStartedAt;
            var session = {
                id: makeId(),
                subject: subject,
                minutes: Math.floor(pendingSessionSeconds / 60),
                seconds: pendingSessionSeconds,
                date: localDate(new Date(startedAt))
            };
            data.sessions.push(session);
            data.timerStartedAt = null;
            if (saveData()) {
                dialog.close();
                render();
            } else {
                data.timerStartedAt = startedAt;
                data.sessions.pop();
                updateTimer();
            }
        });
        timerInterval = window.setInterval(updateTimer, 1000);
        updateTimer();
        window.addEventListener("beforeunload", function () { window.clearInterval(timerInterval); });
    }

    render();
    var clockInterval = window.setInterval(updateDateTime, 15000);
    window.addEventListener("beforeunload", function () { window.clearInterval(clockInterval); });
    bindForms();
    bindTimer();
    var secureOrigin = window.location.protocol === "https:"
        || (window.location.protocol === "http:"
            && (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"));
    if ("serviceWorker" in navigator && secureOrigin) {
        navigator.serviceWorker.register("./service-worker.js").catch(function (error) {
            console.error("JARVIS offline support could not be started:", error);
            notice.textContent = "Offline support couldn't start. Restart JARVIS with run-jarvis.bat.";
        });
    }
}());

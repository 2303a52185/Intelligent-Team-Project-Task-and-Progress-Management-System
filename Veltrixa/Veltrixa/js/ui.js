/* Small helpers used by all pages: escaping text, formats, toasts, dialogs and pagination. */
const UI = (() => {
    const CFG = Api.config;

    /* ---------- text and formatting ---------- */
    const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
    const attr = v => esc(v).replace(/`/g, "&#096;");
    const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
    const date = v => v ? new Date(v + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    const dateTime = v => v ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
    const fileSize = b => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
    const pill = v => `<span class="badge-soft status-${String(v).toLowerCase().replace(/\s+/g, "-")}">${esc(v)}</span>`;
    const priorityPill = v => `<span class="badge-soft ${v === "High" ? "status-overdue" : v === "Low" ? "status-completed" : "status-review"}">${esc(v)}</span>`;
    const options = (list, selected, blank) => (blank ? `<option value="">${esc(blank)}</option>` : "") +
        list.map(o => { const [value, label] = Array.isArray(o) ? o : [o, o]; return `<option value="${attr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(label)}</option>`; }).join("");
    const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

    /* ---------- loading ---------- */
    const loadingBlock = (text = "Loading…") => `<div class="loading-block" role="status"><span class="spinner-border spinner-border-sm"></span> ${esc(text)}</div>`;
    function setTopLoading(isLoading) {
        document.getElementById("topLoader")?.classList.toggle("active", isLoading);
    }
    // disable a button and show a spinner while its request runs
    function setBusy(button, busy, label) {
        if (!button) return;
        if (busy) { button.dataset.label = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${esc(label || "Please wait…")}`; }
        else { button.disabled = false; if (button.dataset.label) button.innerHTML = button.dataset.label; }
    }

    /* ---------- messages ---------- */
    function toast(message, type = "success") {
        const area = document.getElementById("toastArea");
        if (!area) return;
        const el = document.createElement("div");
        el.className = `toast align-items-center border-0 text-bg-${type === "error" ? "danger" : type === "warning" ? "warning" : "success"}`;
        el.setAttribute("role", type === "error" ? "alert" : "status");
        el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
        area.appendChild(el);
        const t = new bootstrap.Toast(el, { delay: type === "error" ? 6000 : 3000 });
        el.addEventListener("hidden.bs.toast", () => el.remove());
        t.show();
    }

    /* ---------- confirm and prompt dialogs (they return a Promise) ---------- */
    function confirmDialog({ title = "Please confirm", message, confirmText = "Confirm", danger = false }) {
        return new Promise(resolve => {
            const el = document.getElementById("confirmModal");
            el.querySelector("[data-confirm-title]").textContent = title;
            el.querySelector("[data-confirm-message]").textContent = message;
            const yes = el.querySelector("[data-confirm-yes]");
            yes.textContent = confirmText;
            yes.className = "btn " + (danger ? "btn-danger" : "btn-primary");
            const modal = bootstrap.Modal.getOrCreateInstance(el);
            let answer = false;
            yes.onclick = () => { answer = true; modal.hide(); };
            el.addEventListener("hidden.bs.modal", () => {
                if (document.querySelector(".modal.show")) document.body.classList.add("modal-open");     // another dialog is still open behind this one
                resolve(answer);
            }, { once: true });
            modal.show();
        });
    }
    function promptDialog({ title, label, confirmText = "Save", required = false, placeholder = "" }) {
        return new Promise(resolve => {
            const el = document.getElementById("promptModal");
            el.querySelector("[data-prompt-title]").textContent = title;
            el.querySelector("[data-prompt-label]").textContent = label;
            const input = el.querySelector("[data-prompt-input]"), error = el.querySelector("[data-prompt-error]"), yes = el.querySelector("[data-prompt-yes]");
            input.value = ""; input.placeholder = placeholder; error.textContent = ""; yes.textContent = confirmText;
            const modal = bootstrap.Modal.getOrCreateInstance(el);
            let answer = null;
            yes.onclick = () => {
                const v = input.value.trim();
                if (required && !v) { error.textContent = "This field is required."; input.focus(); return; }
                answer = v; modal.hide();
            };
            el.addEventListener("shown.bs.modal", () => input.focus(), { once: true });
            el.addEventListener("hidden.bs.modal", () => {
                if (document.querySelector(".modal.show")) document.body.classList.add("modal-open");
                resolve(answer);
            }, { once: true });
            modal.show();
        });
    }

    /* ---------- pagination ---------- */
    // key is the name of the list ("projects", "tasks"...). Buttons carry data-page-key, data-page and data-size-key.
    function paginationHtml(key, p) {
        if (!p) return "";
        const from = p.totalItems ? (p.page - 1) * p.size + 1 : 0, to = Math.min(p.page * p.size, p.totalItems);
        const pages = [];
        for (let i = 1; i <= p.totalPages; i++) if (i === 1 || i === p.totalPages || Math.abs(i - p.page) <= 1) pages.push(i);
        const items = pages.map((n, i) => (i && n - pages[i - 1] > 1 ? `<li class="page-item disabled"><span class="page-link">…</span></li>` : "") +
            `<li class="page-item ${n === p.page ? "active" : ""}"><button class="page-link" data-page-key="${key}" data-page="${n}" ${n === p.page ? 'aria-current="page"' : ""}>${n}</button></li>`).join("");
        return `<div class="pagination-bar"><small class="text-secondary">Showing ${from}–${to} of ${p.totalItems}</small>
            <nav aria-label="Pagination"><ul class="pagination pagination-sm mb-0">
            <li class="page-item ${p.page === 1 ? "disabled" : ""}"><button class="page-link" data-page-key="${key}" data-page="${p.page - 1}">Previous</button></li>${items}
            <li class="page-item ${p.page === p.totalPages ? "disabled" : ""}"><button class="page-link" data-page-key="${key}" data-page="${p.page + 1}">Next</button></li></ul></nav>
            <select class="form-select form-select-sm page-size" data-size-key="${key}" aria-label="Rows per page">${CFG.PAGE_SIZES.map(s => `<option value="${s}" ${s === p.size ? "selected" : ""}>${s} per page</option>`).join("")}</select></div>`;
    }

    return { esc, attr, num, date, dateTime, fileSize, pill, priorityPill, options, debounce, loadingBlock, setTopLoading, setBusy, toast, confirmDialog, promptDialog, paginationHtml };
})();

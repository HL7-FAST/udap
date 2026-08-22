document.addEventListener("DOMContentLoaded", function () {
    var root = document.documentElement;

    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
            var next = root.dataset.mdbTheme === "dark" ? "light" : "dark";
            root.dataset.mdbTheme = next;
            try { localStorage.setItem("theme", next); } catch (e) { }
        });
    });

    document.querySelectorAll("[data-confirm]").forEach(function (element) {
        element.addEventListener("click", function (e) {
            if (!confirm(this.getAttribute("data-confirm"))) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        });
    });

    document.querySelectorAll("[data-copy]").forEach(function (button) {
        button.addEventListener("click", function () {
            navigator.clipboard.writeText(this.getAttribute("data-copy"));
        });
    });
});

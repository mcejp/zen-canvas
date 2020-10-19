/*
- construct TabBar instance
    - set options: close buttons? plus button?
- hook events:
    - ontabchange
    - ontabreorder
    - ontabplusbuttonpressedorsomeshitlikethis
- when ready, update data model & un-disable
- URL hash is then checked
 */

class TabBar {
    /** @var {HTMLElement} container */ container;
    /** @var {HTMLElement} ul */ ul;
    /** @var {Object} options */ options;

    onNewTabButton = null;

    /** @type {Object|null} */ selectionModel = null;
    /** @type {HTMLLIElement|null} */ selectionLi = null;
    /** @type {HTMLLIElement|null} */ newTabLi = null;

    /**
     * @param {HTMLElement} container
     * @param {Object} options
     * @param {boolean} options.withCloseButton
     * @param {boolean} options.newTabButton
     */
    constructor(container, options) {
        this.container = container;
        this.options = options || {};

        this.ul = document.createElement("ul");
        this.container.appendChild(this.ul);
    }

    /**
     * @param {Object} tabModel
     * @param {boolean} editTitle
     * @param {boolean} selectIt
     */
    addTab(tabModel, editTitle, selectIt) {
        const tabLi = this._addTab(tabModel, editTitle);

        if (selectIt) {
            this._selectTab(tabModel, tabLi, true);
        }
    }

    /**
     * @param {Object} model
     * @param {{title: string}[]} model.tabs
     */
    setModel(model) {
        this.ul.textContent = "";

        for (const tabModel of model.tabs) {
            this._addTab(tabModel, false);
        }

        if (this.options.newTabButton === true) {
            this.newTabLi = document.createElement("li");
            this.ul.appendChild(this.newTabLi);

            const newTabButton = document.createElement("a");
            newTabButton.innerHTML = "+";
            this.newTabLi.appendChild(newTabButton);

            newTabButton.addEventListener("click", (ev) => {
                if (this.onNewTabButton) {
                    this.onNewTabButton(ev);
                }
            });
        }

        // TODO: determine which tab is selected
    }

    _addTab(tabModel, editTitle) {
        const li = document.createElement("li");
        this.ul.appendChild(li);

        if (tabModel.selected) {
            li.classList.add("selected");
            this.selectionLi = li;
        }

        const label = document.createElement("div");
        li.appendChild(label);

        if (editTitle) {
            const input = document.createElement("input");
            label.appendChild(input);
            input.type = "text";
            input.value = tabModel.title;

            input.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") {
                    label.innerText = input.value;

                    if (this.onTabRenamed) {
                        this.onTabRenamed(tabModel, input.value);
                    }
                }
            });
        }
        else {
            label.innerText = tabModel.title;
        }

        label.addEventListener("click", (ev) => {
            this._selectTab(tabModel, li, false);
        });

        const control = document.createElement("div");
        li.appendChild(control);

        if (this.options.withCloseButton === true) {
            const closeButton = document.createElement("a");
            // closeButton.innerHTML = "&#x00D7;";     // aka ×
            closeButton.innerHTML = "&#x2716;";     // aka ✖
            control.appendChild(closeButton);
        }

        // Ensure that (+) button is always at the end
        if (this.newTabLi !== null) {
            this.ul.appendChild(this.newTabLi);
        }

        return li;
    }

    /**
     * @param {Object} tabModel
     * @param {HTMLLIElement} tabLi
     */
    _selectTab(tabModel, tabLi, justCreated) {
        if (tabLi === this.selectionLi) {
            return;
        }

        if (this.selectionLi !== null) {
            this.selectionLi.classList.remove("selected");
        }

        this.selectionModel = tabModel;
        this.selectionLi = tabLi;

        if (tabLi !== null) {
            tabLi.classList.add("selected");
        }

        if (this.onTabSelected) {
            this.onTabSelected(tabModel, justCreated);
        }
    }
}

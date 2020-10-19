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
    /** @var {boolean} options.withCloseButton */
    /** @var {boolean} options.newTabButton */

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
     * @param {Object} model
     * @param {{title: string}[]} model.tabs
     */
    setModel(model) {
        this.ul.textContent = "";

        for (const tab of model.tabs) {
            const li = document.createElement("li");
            this.ul.appendChild(li);
            li.classList.add("selected");

            const label = document.createElement("div");
            li.appendChild(label);
            label.innerText = tab.title;

            const control = document.createElement("div");
            li.appendChild(control);

            if (this.options.withCloseButton === true) {
                const closeButton = document.createElement("a");
                // closeButton.innerHTML = "&#x00D7;";     // aka ×
                closeButton.innerHTML = "&#x2716;";     // aka ✖
                control.appendChild(closeButton);
            }
        }

        if (this.options.newTabButton === true) {
            const li = document.createElement("li");
            this.ul.appendChild(li);

            const closeButton = document.createElement("a");
            // closeButton.innerHTML = "&#x00D7;";     // aka ×
            closeButton.innerHTML = "+";
            li.appendChild(closeButton);
        }

        // TODO: determine which tab is selected
    }
}

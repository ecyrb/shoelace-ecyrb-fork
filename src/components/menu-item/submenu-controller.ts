import '../popup/popup.js';

import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { HasSlotController } from '../../internal/slot.js';
import { html } from 'lit';
import { LocalizeController } from '../../utilities/localize.js';
import SlMenuItem from './menu-item.js';
import SlPopup from '../popup/popup.js';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

// https://www.abeautifulsite.net/posts/finding-the-active-element-in-a-shadow-root/
// @ts-ignore
function getActiveElement(root: Document | ShadowRoot = document): Element | null {
  if (root === document) {
    console.log("getActiveElement(document)...");
  } else {
    if (root instanceof Element) {
      console.log(`getActiveElement(${root.tagName})...`);
    } else {
      console.log(root);
    }
  }
  const activeEl = root.activeElement;

  if (!activeEl) {
    return null;
  }

  if (activeEl.shadowRoot) {
    const shadowActiveEl = getActiveElement(activeEl.shadowRoot);
    return (shadowActiveEl) ? shadowActiveEl : activeEl;
  } else {
    return activeEl;
  }
}

/*
function getActiveElementUpwards(node : Node): Node | null {
  console.log("getActiveElementUpwards() {");
  let retValue: Element
  if (node instanceof Element) {
    retValue = 4;
  }
  retValue = 4;  
  console.log(retValue);
  return retValue;
}
*/

/*
function getParentMenuItem(node: Node | null): HTMLElement | null {
  if (node === null) {
    return null;
  }
  if (node instanceof HTMLElement) {
    const elt = node as HTMLElement
    if (elt.tagName.toLowerCase() === "sl-menu-item" || (elt.getAttribute("role") ?? "").startsWith("menuitem")) {
      return elt;
    }
  } 
  if (node.parentNode === null) {
    return null;
  }
  return getParentMenuItem(node.parentNode); 
}
*/


/** A reactive controller to manage the registration of event listeners for submenus. */
export class SubmenuController implements ReactiveController {
  private host: ReactiveControllerHost & SlMenuItem;
  private popupRef: Ref<SlPopup> = createRef();

  private mouseOutTimer: number = -1;
  private isConnected: boolean = false;

  private readonly hasSlotController: HasSlotController;
  private readonly localize: LocalizeController;

  constructor(
    host: ReactiveControllerHost & SlMenuItem,
    hasSlotController: HasSlotController,
    localize: LocalizeController
  ) {
    (this.host = host).addController(this);
    this.hasSlotController = hasSlotController;
    this.localize = localize;
  }

  hostConnected() {
    if (this.hasSlotController.test('submenu') && !this.host.disabled) {
      this.addListeners();
    }
  }

  hostDisconnected() {
    this.removeListeners();
  }

  hostUpdated() {
    if (this.hasSlotController.test('submenu') && !this.host.disabled) {
      this.addListeners();
    } else {
      this.removeListeners();
    }
  }

  private addListeners() {
    if (!this.isConnected) {
      this.host.addEventListener('mouseover', this.handleMouseOver);
      this.host.addEventListener('mouseout', this.handleMouseOut);
      this.host.addEventListener('keydown', (event) => { this.handleKeyDown(event) });
      //document.addEventListener('keydown', this.handleDocumentKeyDown);
      document.addEventListener('mousedown', this.handleDocumentMouseDown);

      this.isConnected = true;
    }
  }

  private removeListeners() {
    if (this.isConnected) {
      this.host.removeEventListener('mouseover', this.handleMouseOver);
      this.host.removeEventListener('mouseout', this.handleMouseOut);
      this.host.removeEventListener('keydown', this.handleKeyDown);
      document.removeEventListener('mousedown', this.handleDocumentMouseDown);

      this.isConnected = false;
    }
  }

  private handleMouseOver = () => {
    clearTimeout(this.mouseOutTimer);
    if (this.hasSlotController.test('submenu') && this.popupRef.value) {
      this.popupRef.value.active = true;
    }
  };

  private handleMouseOut = () => {
    console.log("submenuController.handleMouseOut...");
    const submenuHasFocus: boolean = this.host.querySelector(":focus") ? true : false;

    // TODO Parameterize timeout value
    if (this.popupRef.value && this.popupRef.value.active && !submenuHasFocus) {
      this.mouseOutTimer = window.setTimeout(() => {
        if (this.popupRef.value && this.popupRef.value.active) {
          this.popupRef.value.active = false;
        }
      }, 200);
    }
    console.log("End submenuController.handleMouseOut.");
  };
  
  /** Focus on the first menu-item of a submenu. */
  private handleKeyDown(event: KeyboardEvent) {
    console.log(`submenuController.handleKeyDown: ${event.key}`);
    switch (event.key) {
      case 'Escape':
      case 'Tab':
        console.log("Hiding....");
        if (this.popupRef.value) {
          this.popupRef.value.active = false;
        }
        break;
      case 'ArrowLeft':
        // Either we're focused on the host element or a child.
        console.log("submenu-controller: ArrowLeft");
        const focusedElt = this.host.querySelector(":focus");
        console.log("focused element");
        console.log(focusedElt);
        if (focusedElt !== null && focusedElt !== this.host) {
          event.preventDefault();
          event.stopPropagation();
          this.host.focus();
          if (this.popupRef.value) {
            this.popupRef.value.active = false;
          }
        }
        break;
      case 'ArrowRight':
      case 'Enter':
      case ' ': 

        const submenuSlot: HTMLSlotElement = this.host.renderRoot.querySelector("slot[name='submenu']") as HTMLSlotElement;

        if (!submenuSlot) {
          console.error("submenu-controller onKeyDown: No slot!");
          return;
        }

        // Slot
        console.log(submenuSlot);

        // Menus
        let firstMenuItem: HTMLElement | null = null;
        for (var elt of submenuSlot.assignedElements()) {
          console.log(elt);
          firstMenuItem = elt.querySelector("sl-menu-item, [role^='menuitem']");
          if (firstMenuItem) {
            console.log(`Found a menu-item: ${firstMenuItem}`);
            break;
          }
        }

        if (!firstMenuItem) {
          console.error("Could not find a menu-item.");
          return;
        }

        if (this.popupRef.value) { 
          event.preventDefault();
          event.stopPropagation();
          if(this.popupRef.value.active) {
            firstMenuItem.focus();
          } else { 
            this.popupRef.value.active = true;
            // Require menu-item to be visible to set focus.
            this.host.updateComplete.then(() => {
              firstMenuItem!.focus();
            });
            this.host.requestUpdate(); 
          }
        }
        break;
      default:
        break;  
    }
  } 
  
  private handleDocumentMouseDown = (event: MouseEvent) => {
    // Close when clicking outside of the containing element
    const path = event.composedPath();
    if (this.host && !path.includes(this.host)) {
      if (this.popupRef.value) {
        this.popupRef.value.active = false;
      }
    }
  };
  
  show() {
   
  }

  hide() {

  }

  renderSubmenu() {
    // Always render the slot. Conditionally render the outer sl-popup.

    if (!this.isConnected) {
      return html` <slot name="submenu" hidden></slot> `;
    }

    const isLtr = this.localize.dir() === 'ltr';
    return html`
      <style>
        ::part(popup) {
          z-index: var(--sl-z-index-dropdown);
        }
      </style>
      <sl-popup
        ${ref(this.popupRef)}
        placement=${isLtr ? 'right-start' : 'left-start'}
        anchor="anchor"
        flip
        flip-fallback-strategy="best-fit"
        strategy="fixed"
      >
        <slot name="submenu"></slot>
      </sl-popup>
    `;
  }
}

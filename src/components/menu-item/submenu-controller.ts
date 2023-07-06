import '../popup/popup.js';

import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { HasSlotController } from '../../internal/slot.js';
import { html } from 'lit';
import { LocalizeController } from '../../utilities/localize.js';
import SlMenuItem from './menu-item.js';
import SlPopup from '../popup/popup.js';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

// @ts-ignore
function getActiveElement(root: Document | ShadowRoot = document): Element | null {
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

/** A reactive controller to manage the registration of event listeners for submenus. */
export class SubmenuController implements ReactiveController {
  private host: ReactiveControllerHost & SlMenuItem;
  private popupRef: Ref<SlPopup> = createRef();
  
  private isConnected: boolean = false;
  private skidding: number = 0;

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
      this.updateSkidding();
    } else {
      this.removeListeners();
    }
  }

  private addListeners() {
    if (!this.isConnected) {
      this.host.addEventListener('mouseover', this.handleMouseOver);
      //this.host.addEventListener('mouseout', this.handleMouseOut);
      this.host.addEventListener('keydown', this.handleKeyDown);
      this.host.addEventListener('click', this.handleClick);
      this.host.addEventListener('focusout', this.handleFocusOut);
      document.addEventListener('mousedown', this.handleDocumentMouseDown);

      this.isConnected = true;
    }
  }

  private removeListeners() {
    if (this.isConnected) {
      if (this.popupRef.value) {
        this.popupRef.value.removeEventListener('mouseover', this.submenuMouseover);
      }
      this.host.removeEventListener('mouseover', this.handleMouseOver);
      //this.host.removeEventListener('mouseout', this.handleMouseOut);
      this.host.removeEventListener('keydown', this.handleKeyDown);
      this.host.removeEventListener('click', this.handleClick);
      this.host.removeEventListener('focusout', this.handleFocusOut);
      document.removeEventListener('mousedown', this.handleDocumentMouseDown);

      this.isConnected = false;
    }
  }
  

  private submenuMouseover = (event: MouseEvent) => {
    console.log(`${this.host.id}.popup - mouseover`);
    event.stopPropagation();
  }

  private handleMouseOver = () => {
    //clearTimeout(this.mouseOutTimer);
    console.log(`${this.host.id} - mouseover`);
    if (this.hasSlotController.test('submenu')) {
      console.log(`  ${this.host.id} - has submenu`);
      this.enableSubmenu();
    }
  };

  /*
  private handleMouseOut = () => {
    console.log("submenuController.handleMouseOut...");
    const submenuHasFocus: boolean = this.host.querySelector(":focus") ? true : false;

    // TODO Parameterize timeout value
    if (this.popupRef.value && this.popupRef.value.active && !submenuHasFocus) {
      this.mouseOutTimer = window.setTimeout(() => {
        this.disableSubmenu();
      }, 200);
    }
    console.log("End submenuController.handleMouseOut.");
  };
  */
  
  /** Focus on the first menu-item of a submenu. */
  private handleKeyDown = { handleEvent: (event: KeyboardEvent) => {
    console.log(`submenuController.handleKeyDown: ${event.key}`);
    switch (event.key) {
      case 'Escape':
      case 'Tab':
        console.log("Hiding....");
        this.disableSubmenu();
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
          this.disableSubmenu();
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
            this.enableSubmenu();
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
  } } 
  
  private handleClick = { handleEvent: (event: MouseEvent) => {
    // Clicking on the item which heads the menu does nothing.
    if (event.target === this.host) {
      event.preventDefault();
      event.stopPropagation();
    }
  } }  
  
  /** On blur check if focus is on something that would keep the menu open:
   *    - this element, a sibling, descendent, or immediate parent
   */
  private handleFocusOut = {
    handleEvent: (event: FocusEvent) => {
      console.log("---HANDLE BLUR START--------------------------------");
      console.log(`${this.host.id} handleBlur()`);
      console.log(`  Element losing focus:`);
      console.log(event.target);
      console.log(`  Element gaining focus:`);
      console.log(event.relatedTarget);
      console.log(`  End of ${this.host.id} handleBlur()`);
      
      if (!event.relatedTarget || (event.relatedTarget instanceof Element && !this.host.contains(event.relatedTarget))) {
        this.disableSubmenu();
      }

      console.log("---HANDLE BLUR END--------------------------------");
    }
  }

  private handleDocumentMouseDown = (event: MouseEvent) => {
    // Close when clicking outside of the containing element
    const path = event.composedPath();
    if (this.host && !path.includes(this.host)) {
      this.disableSubmenu();
    }
  };
  
  private setSubmenuState(state: boolean) {
    if (this.popupRef.value) {
      if (this.popupRef.value.active !== state) {
        this.popupRef.value.active = state;
        this.host.requestUpdate();
      }
    }
  }

  private enableSubmenu() {
    console.log(`${this.host.id} enableSubmenu`);
    this.setSubmenuState(true);
  }

  private disableSubmenu() {
    this.setSubmenuState(false);
  }
  
  /** Calculate the space the top of a menu takes-up, for aligning the popup menu-item with the activating element. */
  private updateSkidding(): void {
    const attrs: string[] = ["padding-top", "border-top-width", "margin-top"];
    const styleMap: StylePropertyMapReadOnly = this.host.parentElement!.computedStyleMap();
    
    const skidding = attrs.reduce((accum, attr) => {
      const styleValue: CSSStyleValue = styleMap.get(attr) ?? new CSSUnitValue(0, "px");
      const unitValue = (styleValue instanceof CSSUnitValue) ? styleValue as CSSUnitValue : new CSSUnitValue(0, "px"); 
      const pxValue = unitValue.to("px");
      return accum - pxValue.value;
    }, 0);
    
    this.skidding = skidding;
  }
  
  isExpanded(): boolean {
    return this.popupRef.value ? this.popupRef.value.active : false;
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
        skidding="${this.skidding}"
        strategy="fixed"
      >
        <slot name="submenu"></slot>
      </sl-popup>
    `;
  }
}

import { l as loadFromCheckout } from './loadFromCheckout-CpEUBppu.js';

/**
* @vue/runtime-dom v3.4.23
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/

const vShowOriginalDisplay = Symbol("_vod");
const vShowHidden = Symbol("_vsh");
const vShow = {
  beforeMount(el, { value }, { transition }) {
    el[vShowOriginalDisplay] = el.style.display === "none" ? "" : el.style.display;
    if (transition && value) {
      transition.beforeEnter(el);
    } else {
      setDisplay(el, value);
    }
  },
  mounted(el, { value }, { transition }) {
    if (transition && value) {
      transition.enter(el);
    }
  },
  updated(el, { value, oldValue }, { transition }) {
    if (!value === !oldValue)
      return;
    if (transition) {
      if (value) {
        transition.beforeEnter(el);
        setDisplay(el, true);
        transition.enter(el);
      } else {
        transition.leave(el, () => {
          setDisplay(el, false);
        });
      }
    } else {
      setDisplay(el, value);
    }
  },
  beforeUnmount(el, { value }) {
    setDisplay(el, value);
  }
};
function setDisplay(el, value) {
  el.style.display = value ? el[vShowOriginalDisplay] : "none";
  el[vShowHidden] = !value;
}

var getAdyenPaymentStatus = async (orderId) => {
  const [
    graphQlRequest,
    cartStore,
  ] = await loadFromCheckout([
    'services.graphQlRequest',
    'stores.useCartStore',
  ]);
  const { maskedId, getMaskedId } = cartStore;

  let cartId;
  if (!maskedId) {
    cartId = await getMaskedId();
  } else {
    cartId = maskedId;
  }

  const request = ` {
    adyenPaymentStatus(orderNumber: "${orderId}", cartId: "${cartId}") {
      action
      additionalData
      isFinal
      resultCode
    }
  } `;

  return graphQlRequest(request)
    .then((response) => ({
      ...response.data.adyenPaymentStatus,
      action: JSON.parse(response.data.adyenPaymentStatus.action),
    }));
};

export { getAdyenPaymentStatus as g, vShow as v };

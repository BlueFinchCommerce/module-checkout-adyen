import { l as loadFromCheckout } from '../../../loadFromCheckout-CpEUBppu.js';
import { c as createElementBlock, f as createBlock, g as resolveDynamicComponent, b as createBaseVNode, t as toDisplayString, n as normalizeClass, o as openBlock } from '../../../runtime-core.esm-bundler-Rf9YpmoW.js';

var script = {
  name: 'AdyenPaymentCard',
  props: {
    method: {
      type: Object,
      default: () => {},
    },
  },
  data() {
    return {
      TextField: null,
      Tick: null,
    };
  },
  computed: {
    cardLogo() {
      const { brand } = this.method;
      return `//checkoutshopper-live.adyen.com/checkoutshopper/images/logos/${brand}.svg`;
    },
  },
  async created() {
    const [
      TextField,
      Tick,
    ] = await loadFromCheckout([
      'components.TextField',
      'components.Tick',
    ]);

    this.TextField = TextField;
    this.Tick = Tick;
  },
  methods: {
    async selectPaymentCard() {
      const [
        paymentStore,
      ] = await loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      paymentStore.paymentEmitter.emit('adyenStoredPaymentCardSelected', { originalId: this.method.originalId });
    },
  },
};

const _hoisted_1 = ["aria-label", "data-original-id"];
const _hoisted_2 = /*#__PURE__*/createBaseVNode("span", {
  class: "adyen-checkout__payment-method__radio",
  "aria-hidden": "true"
}, null, -1 /* HOISTED */);
const _hoisted_3 = { class: "adyen-checkout__payment-method__image__wrapper adyen-checkout__payment-method__image__wrapper--outline" };
const _hoisted_4 = ["src", "alt", "data-cy"];
const _hoisted_5 = {
  class: "adyen-checkout__payment-method__card-number",
  "data-cy": "adyen-saved-payment-card-text"
};
const _hoisted_6 = {
  class: "adyen-checkout__payment-method__name",
  "data-cy": "adyen-saved-payment-card-text-number"
};
const _hoisted_7 = {
  class: "adyen-checkout__payment-method__expiry-label",
  "data-cy": "adyen-saved-payment-card-expiry-text"
};
const _hoisted_8 = {
  class: "adyen-checkout__payment-method__expiry",
  "data-cy": "adyen-saved-payment-card-expiry-date"
};

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (openBlock(), createElementBlock("button", {
    class: normalizeClass(["adyen-checkout__payment-method__header__title button", {'adyen-checkout__payment-method-disabled': !$props.method.default}]),
    "aria-label": _ctx.$t('paymentCard.storedPaymentLabel', { name: $props.method.name, lastFour: $props.method.lastFour }),
    type: "button",
    "data-original-id": $props.method.originalId,
    "data-cy": "adyen-saved-payment-card-button",
    onClick: _cache[0] || (_cache[0] = (...args) => ($options.selectPaymentCard && $options.selectPaymentCard(...args)))
  }, [
    ($props.method.default)
      ? (openBlock(), createBlock(resolveDynamicComponent($data.Tick), {
          key: 0,
          class: "adyen-checkout__payment-method-tick",
          "data-cy": 'adyen-saved-payment-card-active-icon'
        }))
      : (openBlock(), createBlock(resolveDynamicComponent($data.TextField), {
          key: 1,
          class: "adyen-checkout__payment-method-select",
          text: _ctx.$t('paymentCard.select'),
          "data-cy": 'adyen-saved-payment-card-select-text'
        }, null, 8 /* PROPS */, ["text"])),
    _hoisted_2,
    createBaseVNode("span", _hoisted_3, [
      createBaseVNode("img", {
        class: "adyen-checkout__payment-method__image",
        src: $options.cardLogo,
        alt: $props.method.name,
        "data-cy": `adyen-saved-payment-card-${$props.method.name}-icon`
      }, null, 8 /* PROPS */, _hoisted_4)
    ]),
    createBaseVNode("span", _hoisted_5, toDisplayString(_ctx.$t('paymentCard.cardNumber')), 1 /* TEXT */),
    createBaseVNode("span", _hoisted_6, " **** **** **** " + toDisplayString($props.method.lastFour), 1 /* TEXT */),
    createBaseVNode("span", _hoisted_7, toDisplayString(_ctx.$t('paymentCard.expiry')), 1 /* TEXT */),
    createBaseVNode("span", _hoisted_8, toDisplayString($props.method.expiryMonth) + "/" + toDisplayString($props.method.expiryYear), 1 /* TEXT */)
  ], 10 /* CLASS, PROPS */, _hoisted_1))
}

script.render = render;
script.__file = "src/components/DropIn/PaymentCard/PaymentCard.vue";

export { script as default };
